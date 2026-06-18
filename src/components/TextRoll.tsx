
interface TextRollProps {
  text: string;
  className?: string;
  id?: string;
}

export default function TextRoll({ text, className = '', id }: TextRollProps) {
  return (
    <div id={id} className={`overflow-hidden h-5 relative select-none ${className}`}>
      <div className="transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2 flex flex-col items-start">
        <span className="h-5 flex items-center leading-none whitespace-nowrap">
          {text}
        </span>
        <span className="h-5 flex items-center leading-none whitespace-nowrap select-none">
          {text}
        </span>
      </div>
    </div>
  );
}
