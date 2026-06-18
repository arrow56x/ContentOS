import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface LiveClockProps {
  id?: string;
}

export default function LiveClock({ id }: LiveClockProps) {
  const [time, setTime] = useState<string>('--:--');

  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };
      const formatted = new Intl.DateTimeFormat('en-GB', options).format(new Date());
      setTime(formatted);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div id={id} className="flex items-center gap-1.5 text-gray-600">
      <Clock size={14} className="shrink-0" />
      <span className="text-[13px] tracking-tight">{time} in London</span>
    </div>
  );
}
