import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";

interface Props {
  onScan: (code: string) => void;
  disabled?: boolean;
}

/**
 * Auto-focused input optimized for handheld barcode scanners (act as keyboard + Enter).
 * Re-focuses on blur to prevent losing scans.
 */
const ScanInput = ({ onScan, disabled }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  const buffer = useRef("");

  useEffect(() => {
    ref.current?.focus();
  }, [disabled]);

  // Re-focus on any click outside
  useEffect(() => {
    const handler = () => {
      if (!disabled && document.activeElement !== ref.current) {
        ref.current?.focus();
      }
    };
    const id = setInterval(handler, 1000);
    return () => clearInterval(id);
  }, [disabled]);

  return (
    <div className="relative">
      <ScanLine className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7 text-primary animate-pulse" />
      <Input
        ref={ref}
        disabled={disabled}
        autoFocus
        dir="ltr"
        placeholder="امسح الباركود الآن... (Scan now)"
        className="h-20 text-2xl text-center font-mono tracking-widest border-4 border-primary/50 focus-visible:border-primary shadow-lg"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = buffer.current.trim();
            if (val) onScan(val);
            buffer.current = "";
            if (ref.current) ref.current.value = "";
          }
        }}
        onChange={(e) => {
          buffer.current = e.target.value;
        }}
        onBlur={() => {
          setTimeout(() => {
            if (!disabled) ref.current?.focus();
          }, 50);
        }}
      />
    </div>
  );
};

export default ScanInput;
