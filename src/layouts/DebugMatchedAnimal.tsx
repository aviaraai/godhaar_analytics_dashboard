import { TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MatchedAnimal } from "@/lib/api";
import DebugImages from "./DebugImages";

/**
 * The already-registered animal a record was decided against — the right-hand
 * column of the comparison, on a search that matched and on a registration
 * refused as a duplicate alike.
 *
 * Identity and photos and nothing else: breed, age, owner and location say
 * nothing about whether the model was right. Which slots arrive is the
 * endpoint's business — four from a search, two from a registration — so this
 * renders whatever it is given rather than expecting a shape.
 *
 * `deleted` means the id no longer resolves. The id is still shown, because the
 * record stands as evidence of what the model said, and `images` simply comes
 * back empty — which is also what an animal registered without photos looks
 * like, hence the two different empty hints.
 */
export default function DebugMatchedAnimal({
  animal,
  onRefresh,
  onNavigateToAnimal,
}: {
  animal: MatchedAnimal;
  onRefresh: () => void;
  onNavigateToAnimal: (animal: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <DebugImages
        images={animal.images}
        label={`Registered photo of ${animal.godhaar_id}`}
        origin="db"
        onRefresh={onRefresh}
        emptyHint={
          animal.deleted
            ? "This animal has been deleted, so its photos are gone."
            : "This animal has no registered photos."
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <AnimalLink id={animal.godhaar_id} onNavigate={onNavigateToAnimal} />
        {animal.deleted && (
          <Badge variant="destructive">
            <TrashIcon /> deleted
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Every other record touching this animal. There is no animal record screen in
 * this dashboard to point at, so this switches to the thing that does exist
 * and is useful while reviewing: the animal's own debug history, filtered down
 * to it on the Searches tab.
 */
export function AnimalLink({
  id,
  onNavigate,
}: {
  id: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      className="font-mono text-sm font-medium underline-offset-4 hover:underline"
    >
      {id}
    </button>
  );
}
