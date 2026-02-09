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
  removeFaceEnrollment as apiRemove,
  getFaceEnrollmentRecords,
} from '@/api/face';
import type { FaceEnrollmentRecord } from '@/types';
import type { EnrollResult } from '@/api/face';

const API_URL = import.meta.env.VITE_API_URL;
export const useBackendEnabled = !!API_URL;

export function useBackendFace() {
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
      const result = await apiEnroll(classId, studentId, imageBase64, options);
      if (result.success) refresh();
      return result;
    },
    [refresh]
  );

  const recognize = useCallback(
    async (classId: string, imageBase64: string, signal?: AbortSignal) => {
      return recognizeFace(classId, imageBase64, signal);
    },
    []
  );

  const getFaceEnrollmentCount = useCallback(
    async (classId: string, studentId: string): Promise<number> => {
      return getFaceCount(classId, studentId);
    },
    []
  );

  const getEnrolledStudentIdsAsync = useCallback(
    async (classId: string): Promise<string[]> => {
      return getEnrolledStudentIds(classId);
    },
    []
  );

  const removeFaceEnrollment = useCallback(
    async (classId: string, studentId: string) => {
      await apiRemove(classId, studentId);
      refresh();
    },
    [refresh]
  );

  const removeFaceByIndex = useCallback(
    async (classId: string, studentId: string, index: number) => {
      await apiRemove(classId, studentId, index);
      refresh();
    },
    [refresh]
  );

  const getStudentFacesAsync = useCallback(
    async (classId: string, studentId: string): Promise<FaceEnrollmentRecord[]> => {
      const records = await getFaceEnrollmentRecords(classId, studentId);
      return records.map((r) => ({
        embedding: [],
        model_version: 'insightface',
        enrolledAt: r.enrolledAt,
        confidence: r.confidence,
      }));
    },
    []
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
      removeFaceEnrollment,
      removeFaceByIndex,
      getStudentFacesAsync,
      faceVersion,
    ]
  );
}
