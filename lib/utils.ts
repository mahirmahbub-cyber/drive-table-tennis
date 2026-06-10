import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Read the clock outside render so Server Components stay pure (react-hooks/purity).
export function requestNow(): number {
  return Date.now()
}
