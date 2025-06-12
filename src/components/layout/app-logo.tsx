
import Link from 'next/link';
import { Newspaper } from 'lucide-react';

export function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
      <Newspaper className="h-6 w-6" />
      <span className="font-headline">Meus Editais</span>
    </Link>
  );
}
