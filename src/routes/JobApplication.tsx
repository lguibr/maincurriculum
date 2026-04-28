import { useParams } from "react-router-dom";
import { Briefcase } from "lucide-react";

export default function JobApplication() {
  const { company, role } = useParams();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]">
        <Briefcase className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Application Hub
      </h1>
      <p className="text-neutral-400 max-w-md">
        This workspace is dedicated to tracking the application and tailoring the master CV specifically for <span className="font-bold text-blue-400 capitalize">{role}</span> at <span className="font-bold text-white capitalize">{company}</span>.
      </p>
    </div>
  );
}
