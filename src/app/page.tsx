import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect the root page to /square since that's where the app lives
  redirect('/square');
}
