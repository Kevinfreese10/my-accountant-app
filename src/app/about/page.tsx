import { redirect } from 'next/navigation';

/**
 * @fileOverview Redundant About page. 
 * Content has been merged into the homepage. 
 * Permanently redirecting to root.
 */

export default function AboutPage() {
  redirect('/');
}
