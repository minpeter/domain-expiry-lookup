// MilestoneProgressBar.tsx (새 파일 또는 App.tsx 내부에 정의)
import React from "react";
// 예시 아이콘, 원하는 아이콘으로 변경 가능
import { FaCalendarPlus, FaCalendarTimes } from "react-icons/fa";

interface MilestoneProgressBarProps {
  percentage: number; // 진행률 (0-100)
  startDate: string; // 시작 날짜 (포맷된 문자열)
  endDate: string; // 종료 날짜 (포맷된 문자열)
  startIcon?: React.ReactNode; // 시작 아이콘 커스텀 옵션
  endIcon?: React.ReactNode; // 종료 아이콘 커스텀 옵션
}

const MilestoneProgressBar: React.FC<MilestoneProgressBarProps> = ({
  percentage,
  startDate,
  endDate,
  startIcon = <FaCalendarPlus size={12} />, // 기본 시작 아이콘
  endIcon = <FaCalendarTimes size={12} />, // 기본 종료 아이콘
}) => {
  // 퍼센티지 값을 0과 100 사이로 제한
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const isCompleted = clampedPercentage >= 100; // 완료(만료) 여부

  return (
    <div className="w-full py-3 px-1">
      {" "}
      {/* 컴포넌트 전체 영역 */}
      {/* 프로그래스 바와 마일스톤 컨테이너 */}
      <div className="relative flex items-center h-6">
        {" "}
        {/* 높이 확보 */}
        {/* 1. 마일스톤 (아이콘) - 바 위에 오도록 z-index 사용 */}
        <div className="absolute left-0 right-0 flex justify-between items-center z-10 px-0">
          {/* 시작 마일스톤 */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shadow border border-gray-200
                           ${
                             clampedPercentage >= 0
                               ? "bg-blue-500 text-white"
                               : "bg-gray-300 text-gray-500"
                           }`}
          >
            {startIcon}
          </div>
          {/* 종료 마일스톤 */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shadow border
                           ${
                             isCompleted
                               ? "bg-blue-500 text-white border-blue-600"
                               : "bg-white text-gray-400 border-gray-300"
                           }`}
          >
            {endIcon}
          </div>
        </div>
        {/* 2. 프로그래스 바 트랙 및 채우기 - 마일스톤 아래에 오도록 z-index 없음 */}
        {/* 트랙 (배경) - 아이콘 노드가 살짝 겹치도록 약간의 마진 */}
        <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-3">
          {/* 채우기 (진행률) */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${clampedPercentage}%` }}
            role="progressbar"
            aria-valuenow={clampedPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Domain registration progress"
          ></div>
        </div>
      </div>
      {/* 3. 레이블 (날짜) */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
        <span>{startDate}</span>
        <span>{endDate}</span>
      </div>
    </div>
  );
};

export default MilestoneProgressBar; // 별도 파일일 경우 export
