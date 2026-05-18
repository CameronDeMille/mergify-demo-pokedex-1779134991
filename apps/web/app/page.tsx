import { loadPokemon } from "./lib/pokemon";

export default function Page() {
  const pokemon = loadPokemon();
  return (
    <main>
      <h1>Pokedex</h1>
      <ul>
        {pokemon.map((p) => (
          <li key={p.id}>
            #{p.id} {p.name} — {p.types.join(", ")}
          </li>
        ))}
      </ul>
    </main>
  );
}
