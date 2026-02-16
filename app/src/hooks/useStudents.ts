import { useState, useCallback, useEffect } from 'react';
import type { Student } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function useStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Load students from Supabase
  useEffect(() => {
    if (!user) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const loadStudents = async () => {
      try {
        // Load students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (studentsError) {
          console.error('Error loading students:', studentsError);
          setStudents([]);
          setLoading(false);
          return;
        }

        // Load student_classrooms relationships
        const studentIds = studentsData?.map(s => s.id) || [];
        let classRelationships: Record<string, string[]> = {};

        if (studentIds.length > 0) {
          const { data: relationsData, error: relationsError } = await supabase
            .from('student_classrooms')
            .select('student_id, classroom_id')
            .in('student_id', studentIds);

          if (!relationsError && relationsData) {
            relationsData.forEach(rel => {
              if (!classRelationships[rel.student_id]) {
                classRelationships[rel.student_id] = [];
              }
              classRelationships[rel.student_id].push(rel.classroom_id);
            });
          }
        }

        // Transform to Student format
        const transformedStudents: Student[] = (studentsData || []).map(s => ({
          id: s.id,
          studentId: s.student_id,
          firstName: s.first_name,
          lastName: s.last_name,
          email: s.email || undefined,
          dateOfBirth: s.date_of_birth || undefined,
          gender: s.gender || undefined,
          status: s.status as Student['status'],
          faceEnrolled: s.face_enrolled || false,
          faceEnrollmentCount: s.face_enrollment_count || 0,
          classIds: classRelationships[s.id] || [],
        }));

        setStudents(transformedStudents);
      } catch (error) {
        console.error('Error loading students:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();

    // Subscribe to changes
    const subscription = supabase
      .channel('students_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadStudents();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const getStudentsByClass = useCallback(
    (classId: string) => {
      return students.filter(s => s.classIds.includes(classId));
    },
    [students]
  );

  const getStudentById = useCallback(
    (id: string) => {
      return students.find(s => s.id === id);
    },
    [students]
  );

  const addStudent = useCallback(
    async (student: Omit<Student, 'id' | 'faceEnrolled' | 'faceEnrollmentCount'>) => {
      if (!user) throw new Error('User not authenticated');

      try {
        // Insert student
        const { data: newStudentData, error: insertError } = await supabase
          .from('students')
          .insert({
            user_id: user.id,
            student_id: student.studentId,
            first_name: student.firstName,
            last_name: student.lastName,
            email: student.email,
            date_of_birth: student.dateOfBirth,
            gender: student.gender,
            status: student.status || 'active',
            face_enrolled: false,
            face_enrollment_count: 0,
          })
          .select()
          .single();

        if (insertError) {
          // รหัสนักเรียนซ้ำ (UNIQUE user_id, student_id) - รองรับหลายรูปแบบ error จาก Supabase
          const errMsg = (insertError as any).message ?? '';
          const errCode = (insertError as any).code ?? '';
          if (errCode === '23505' || errMsg.includes('23505') || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('already exists')) {
            throw new Error('รหัสนักเรียนนี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น');
          }
          throw insertError;
        }

        // Insert student_classrooms relationships
        if (student.classIds && student.classIds.length > 0) {
          const relations = student.classIds.map(classroomId => ({
            student_id: newStudentData.id,
            classroom_id: classroomId,
          }));

          const { error: relationsError } = await supabase
            .from('student_classrooms')
            .insert(relations);

          if (relationsError) {
            console.error('Error adding student-classroom relations:', relationsError);
          }
        }

        // Reload students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!studentsError && studentsData) {
          // Load relationships
          const studentIds = studentsData.map(s => s.id);
          const { data: relationsData } = await supabase
            .from('student_classrooms')
            .select('student_id, classroom_id')
            .in('student_id', studentIds);

          const classRelationships: Record<string, string[]> = {};
          relationsData?.forEach(rel => {
            if (!classRelationships[rel.student_id]) {
              classRelationships[rel.student_id] = [];
            }
            classRelationships[rel.student_id].push(rel.classroom_id);
          });

          const transformedStudents: Student[] = studentsData.map(s => ({
            id: s.id,
            studentId: s.student_id,
            firstName: s.first_name,
            lastName: s.last_name,
            email: s.email || undefined,
            dateOfBirth: s.date_of_birth || undefined,
            gender: s.gender || undefined,
            status: s.status as Student['status'],
            faceEnrolled: s.face_enrolled || false,
            faceEnrollmentCount: s.face_enrollment_count || 0,
            classIds: classRelationships[s.id] || [],
          }));

          setStudents(transformedStudents);
        }

        return {
          id: newStudentData.id,
          ...student,
          faceEnrolled: false,
          faceEnrollmentCount: 0,
        };
      } catch (error) {
        console.error('Error adding student:', error);
        throw error;
      }
    },
    [user]
  );

  const updateStudent = useCallback(
    async (id: string, updates: Partial<Pick<Student, 'studentId' | 'firstName' | 'lastName' | 'email' | 'status' | 'classIds'>>) => {
      if (!user) throw new Error('User not authenticated');

      try {
        // Update student
        const updateData: any = {};
        if (updates.studentId !== undefined) updateData.student_id = updates.studentId;
        if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
        if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.status !== undefined) updateData.status = updates.status;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('students')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id);

          if (updateError) {
            const errMsg = (updateError as any).message ?? '';
            const errCode = (updateError as any).code ?? '';
            if (errCode === '23505' || errMsg.includes('23505') || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('already exists')) {
              throw new Error('รหัสนักเรียนนี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น');
            }
            throw updateError;
          }
        }

        // Update class relationships if classIds changed
        if (updates.classIds !== undefined) {
          // Delete existing relations
          await supabase
            .from('student_classrooms')
            .delete()
            .eq('student_id', id);

          // Insert new relations
          if (updates.classIds.length > 0) {
            const relations = updates.classIds.map(classroomId => ({
              student_id: id,
              classroom_id: classroomId,
            }));

            const { error: relationsError } = await supabase
              .from('student_classrooms')
              .insert(relations);

            if (relationsError) {
              console.error('Error updating student-classroom relations:', relationsError);
            }
          }
        }

        // Reload students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!studentsError && studentsData) {
          const studentIds = studentsData.map(s => s.id);
          const { data: relationsData } = await supabase
            .from('student_classrooms')
            .select('student_id, classroom_id')
            .in('student_id', studentIds);

          const classRelationships: Record<string, string[]> = {};
          relationsData?.forEach(rel => {
            if (!classRelationships[rel.student_id]) {
              classRelationships[rel.student_id] = [];
            }
            classRelationships[rel.student_id].push(rel.classroom_id);
          });

          const transformedStudents: Student[] = studentsData.map(s => ({
            id: s.id,
            studentId: s.student_id,
            firstName: s.first_name,
            lastName: s.last_name,
            email: s.email || undefined,
            dateOfBirth: s.date_of_birth || undefined,
            gender: s.gender || undefined,
            status: s.status as Student['status'],
            faceEnrolled: s.face_enrolled || false,
            faceEnrollmentCount: s.face_enrollment_count || 0,
            classIds: classRelationships[s.id] || [],
          }));

          setStudents(transformedStudents);
        }
      } catch (error) {
        console.error('Error updating student:', error);
        throw error;
      }
    },
    [user]
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      if (!user) throw new Error('User not authenticated');

      try {
        // Delete student (cascade will delete student_classrooms and attendance)
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        // Reload students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!studentsError && studentsData) {
          const studentIds = studentsData.map(s => s.id);
          const { data: relationsData } = await supabase
            .from('student_classrooms')
            .select('student_id, classroom_id')
            .in('student_id', studentIds);

          const classRelationships: Record<string, string[]> = {};
          relationsData?.forEach(rel => {
            if (!classRelationships[rel.student_id]) {
              classRelationships[rel.student_id] = [];
            }
            classRelationships[rel.student_id].push(rel.classroom_id);
          });

          const transformedStudents: Student[] = studentsData.map(s => ({
            id: s.id,
            studentId: s.student_id,
            firstName: s.first_name,
            lastName: s.last_name,
            email: s.email || undefined,
            dateOfBirth: s.date_of_birth || undefined,
            gender: s.gender || undefined,
            status: s.status as Student['status'],
            faceEnrolled: s.face_enrolled || false,
            faceEnrollmentCount: s.face_enrollment_count || 0,
            classIds: classRelationships[s.id] || [],
          }));

          setStudents(transformedStudents);
        }
      } catch (error) {
        console.error('Error deleting student:', error);
        throw error;
      }
    },
    [user]
  );

  return {
    students,
    loading,
    getStudentsByClass,
    getStudentById,
    addStudent,
    updateStudent,
    deleteStudent,
  };
}
