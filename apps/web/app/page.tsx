import Link from "next/link";
import { loadPage } from "./lib/pokemon";

const PAGE_SIZE = 10;

export default function Page({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const requested = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;
  const result = loadPage(page, PAGE_SIZE);

  return (
    <main>
      <h1>Pokedex</h1>
      <p>
        Page {result.page} — {result.items.length} of {result.total}
      </p>
      <ul>
        {result.items.map((p) => (
          <li key={p.id}>
            #{p.id} {p.name} — {p.types.join(", ")}
          </li>
        ))}
      </ul>
      {result.hasNext && (
        <Link href={`/?page=${result.page + 1}`}>next page</Link>
      )}
    </main>
  );
}
