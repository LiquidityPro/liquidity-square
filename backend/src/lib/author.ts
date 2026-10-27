import { Prisma } from "@prisma/client";

export const AUTHOR_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  image: true,
  username: true,
  title: true,
  verified: true,
} satisfies Prisma.UserSelect;

type AuthorRow = Prisma.UserGetPayload<{ select: typeof AUTHOR_SELECT }>;

export type AuthorDto = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  image: string | null;
  title: string | null;
  verified: boolean;
};

// Stored username wins. Accounts that have not chosen one yet still show the email's local part.
export function toAuthorDto(user: AuthorRow): AuthorDto {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "LQ";

  return {
    id: user.id,
    name,
    handle: user.username || user.email.split("@")[0],
    initials,
    image: user.image,
    title: user.title,
    verified: user.verified,
  };
}
