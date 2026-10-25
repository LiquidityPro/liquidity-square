import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  mark = false,
  priority = false,
  className,
}: {
  /** Icon only, for the mobile header and the boot splash. */
  mark?: boolean;
  priority?: boolean;
  className?: string;
}) {
  if (mark) {
    return (
      <div role="img" aria-label="Liquidity Square" className={cn("relative size-8", className)}>
        <Image
          src="/liquidity_square_light_icon.svg"
          alt=""
          fill
          priority={priority}
          sizes="128px"
          className="object-contain dark:hidden"
        />
        <Image
          src="/liquidity_square_dark_icon.svg"
          alt=""
          fill
          priority={priority}
          sizes="128px"
          className="hidden object-contain dark:block"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Liquidity Square"
      className="flex items-center"
    >
      <Image
        src="/liquidity_square_light_icon.svg"
        alt=""
        width={48}
        height={43}
        className="h-8 w-8 object-cover object-left dark:hidden xl:hidden"
      />
      <Image
        src="/liquidity_square_dark_icon.svg"
        alt=""
        width={48}
        height={43}
        className="hidden h-8 w-8 object-cover object-left dark:block xl:dark:hidden"
      />
      <Image
        src="/liquidity_square_light_combined.svg"
        alt=""
        width={645}
        height={220}
        className="hidden h-auto w-38 dark:hidden xl:block"
      />
      <Image
        src="/liquidity_square_dark_combined.svg"
        alt=""
        width={645}
        height={220}
        className="hidden h-auto w-38 xl:dark:block"
      />
    </div>
  );
}
