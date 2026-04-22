import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine class names safely with Tailwind merge.
 * Example: cn("p-2", condition && "bg-red-500")
 */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}
