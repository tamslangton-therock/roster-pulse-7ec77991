import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function readMonthDay(value: string): { day: number | null; month: number | null } {
  const text = value.trim();
  const iso = text.match(/^\d{4}-(\d{1,2})-(\d{1,2})/);
  if (iso) return { month: Number(iso[1]), day: Number(iso[2]) };
  const dayMonth = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dayMonth) return { day: Number(dayMonth[1]), month: Number(dayMonth[2]) };
  return { day: null, month: null };
}

function daysInMonth(month: number | null): number {
  if (!month) return 31;
  return new Date(2024, month, 0).getDate();
}

function birthdayValue(day: number | null, month: number | null): string {
  if (!day || !month) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export function BirthdayInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const current = readMonthDay(value);
  const [day, setDay] = useState<number | null>(current.day);
  const [month, setMonth] = useState<number | null>(current.month);
  const dayLimit = daysInMonth(month);

  useEffect(() => {
    const next = readMonthDay(value);
    setDay(next.day);
    setMonth(next.month);
  }, [value]);

  const changeDay = (next: string) => {
    const nextDay = Number(next);
    setDay(nextDay);
    if (month) onChange(birthdayValue(nextDay, month));
  };

  const changeMonth = (next: string) => {
    const nextMonth = Number(next);
    const nextDay = day && day <= daysInMonth(nextMonth) ? day : null;
    setMonth(nextMonth);
    setDay(nextDay);
    if (nextDay) onChange(birthdayValue(nextDay, nextMonth));
  };

  const clear = () => {
    setDay(null);
    setMonth(null);
    onChange("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={day ? String(day) : undefined} onValueChange={changeDay}>
        <SelectTrigger className="w-24" aria-label="Birthday day">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: daysInMonth(month) }, (_, index) => index + 1).map((option) => (
            <SelectItem key={option} value={String(option)}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={month ? String(month) : undefined} onValueChange={changeMonth}>
        <SelectTrigger className="min-w-40 flex-1" aria-label="Birthday month">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, index) => (
            <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(value || day || month) && (
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      )}
    </div>
  );
}