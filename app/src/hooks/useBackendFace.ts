/**
 * Hook for backend face API (RetinaFace + InsightFace)
 * ใช้เมื่อ VITE_API_URL ถูกตั้งค่า
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  checkBackendHealth,
  debugExtract,
  enrollFace as apiEnroll,
  recognizeFace,
  testConnection,
  getFaceCount,
  getEnrolledStudentIds,
  getFaceCountsForClass,
  removeFaceEnrollment as apiRemove,
  getFaceEnrollmentRecords,
} from '@/api/face';
import type { FaceEnrollmentRecord } from '@/types';
import type { EnrollResult } from '@/api/face';
import { useAuth } from './useAuth';

const API_URL = import.meta.env.VITE_API_URL;
export const useBackendEnabled = !!API_URL;

export function useBackendFace() {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [faceVersion, setFaceVersion] = useState(0);

  useEffect(() => {
    checkBackendHealth().then(setIsAvailable);
    const interval = setInterval(() => checkBackendHealth().then(setIsAvailable), 10000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => setFaceVersion((v) => v + 1), []);

  const enrollFace = useCallback(
    async (classId: string, studentId: string, imageBase64: string, options?: { allowDuplicate?: boolean }): Promise<EnrollResult> => {
      if (!user) throw new Error('User not authenticated');
      const result = await apiEnroll(user.id, classId, studentId, imageBase64, options);
      if (result.success) refresh();
      return result;
    },
    [user, refresh]
  );

  const recognize = useCallback(
    async (classId: string, imageBase64: string, signal?: AbortSignal) => {
      if (!user) throw new Error('User not authenticated');
      return recognizeFace(user.id, classId, imageBase64, signal);
    },
    [user]
  );

  const getFaceEnrollmentCount = useCallback(
    async (classId: string, studentId: string): Promise<number> => {
      if (!user) return 0;
      return getFaceCount(user.id, classId, studentId);
    },
    [user]
  );

  const getEnrolledStudentIdsAsync = useCallback(
    async (classId: string): Promise<string[]> => {
      if (!user) return [];
      return getEnrolledStudentIds(user.id, classId);
    },
    [user]
  );

  const getFaceCountsForClassAsync = useCallback(
    async (classId: string): Promise<Record<string, number>> => {
      if (!user) return {};
      return getFaceCountsForClass(user.id, classId);
    },
    [user]
  );

  const removeFaceEnrollment = useCallback(
    async (classId: string, studentId: string) => {
      if (!user) throw new Error('User not authenticated');
      await apiRemove(user.id, classId, studentId);
      refresh();
    },
    [user, refresh]
  );

  const removeFaceByIndex = useCallback(
    async (classId: string, studentId: string, index: number) => {
      if (!user) throw new Error('User not authenticated');
      await apiRemove(user.id, classId, studentId, index);
      refresh();
    },
    [user, refresh]
  );

  const getStudentFacesAsync = useCallback(
    async (classId: string, studentId: string): Promise<FaceEnrollmentRecord[]> => {
      if (!user) return [];
      const records = await getFaceEnrollmentRecords(user.id, classId, studentId);
      return records.map((r) => ({
        embedding: [],
        model_version: 'insightface',
        enrolledAt: r.enrolledAt,
        confidence: r.confidence,
      }));
    },
    [user]
  );

  const debugExtractFace = useCallback(
    async (imageBase64: string) => {
      return debugExtract(imageBase64);
    },
    []
  );

  const testConnectionToBackend = useCallback(
    async (imageBase64?: string) => {
      return testConnection(imageBase64);
    },
    []
  );

  return useMemo(
    () => ({
      isAvailable,
      enrollFace,
      debugExtractFace,
      testConnectionToBackend,
      recognize,
      getFaceEnrollmentCount,
      getEnrolledStudentIdsAsync,
      getFaceCountsForClassAsync,
      removeFaceEnrollment,
      removeFaceByIndex,
      getStudentFacesAsync,
      faceVersion,
    }),
    [
      isAvailable,
      enrollFace,
      debugExtractFace,
      testConnectionToBackend,
      recognize,
      getFaceEnrollmentCount,
      getEnrolledStudentIdsAsync,
      getFaceCountsForClassAsync,
      removeFaceEnrollment,
      removeFaceByIndex,
      getStudentFacesAsync,
      faceVersion,
    ]
  );
}
