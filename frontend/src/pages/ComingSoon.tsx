import React from 'react';

const ComingSoon: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-3xl p-12 shadow-sm flex flex-col gap-4 text-center max-w-md">
        <h1 className="text-3xl font-bold text-gen-textDark">Coming Soon</h1>
        <p className="text-gen-textLight leading-relaxed">
          This feature is currently under active development. Check back later to see the new capabilities!
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;
