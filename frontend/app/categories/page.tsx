import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function getCategories() {
  try {
    const res = await fetch(`${API_URL}/api/categories`, { next: { revalidate: 60 } });
    const data = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
}

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Categories</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((c: { id: string; name: string; slug: string }) => (
          <Link key={c.id} href={`/auctions?categoryId=${c.id}`}>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <h3 className="font-medium">{c.name}</h3>
                <p className="text-sm text-muted-foreground">Browse auctions</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {categories.length === 0 && (
        <p className="text-muted-foreground">No categories yet.</p>
      )}
    </div>
  );
}
