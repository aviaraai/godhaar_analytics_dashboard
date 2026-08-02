import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { LocationOption } from "@/lib/types";

type LocationFieldProps<T extends LocationOption> = {
  id: string;
  label: string;
  placeholder: string;
  items: T[];
  value: T | null;
  onValueChange: (value: T | null) => void;
  emptyMessage: string;
  disabled?: boolean;
};

/**
 * One level of a cascading place filter. Shared by both tabs: the current data
 * fills it with `{ id, label }` pairs from `constants/`, the legacy data with
 * options whose id and label are both the place name. Nothing here cares which,
 * which is the whole reason it takes `LocationOption` rather than either tree.
 */
export default function LocationField<T extends LocationOption>({
  id,
  label,
  placeholder,
  items,
  value,
  onValueChange,
  emptyMessage,
  disabled = false,
}: LocationFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Combobox<T>
        items={items}
        value={value}
        onValueChange={onValueChange}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.id}
        isItemEqualToValue={(a, b) => a.id === b.id}
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          showClear={value !== null}
          className="w-full"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: T) => (
              <ComboboxItem key={item.id} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
