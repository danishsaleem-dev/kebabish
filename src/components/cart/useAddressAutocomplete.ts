import { useEffect, useRef } from "react";

export interface ParsedAddress {
  street: string;
  postcode: string;
  city: string;
}

const SCRIPT_ID = "google-places-script";

/**
 * Attaches Google's Places Autocomplete widget to a street-address input.
 *
 * Loads the Maps JS script itself (with the `places` library) on demand —
 * this is the only place on the site that needs it, so it's not loaded
 * globally. `onSelect` is read through a ref rather than a dependency so
 * the widget is only ever created once per mount, not re-attached on
 * every render.
 *
 * Fails silently if the key is missing or the script/API errors — the
 * street/postcode/city fields are plain inputs underneath, so manual entry
 * always keeps working regardless.
 */
export function useAddressAutocomplete(
  apiKey: string | undefined,
  onSelect: (address: ParsedAddress) => void
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;
    let listener: google.maps.MapsEventListener | undefined;

    function attach() {
      if (cancelled || !inputRef.current || !window.google?.maps?.places) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "nl" },
        fields: ["address_components"],
        types: ["address"],
      });

      listener = autocomplete.addListener("place_changed", () => {
        const components = autocomplete.getPlace().address_components;
        if (!components) return;

        const part = (type: string) =>
          components.find((c) => c.types.includes(type))?.long_name ?? "";

        const street = [part("route"), part("street_number")]
          .filter(Boolean)
          .join(" ");
        const postcode = part("postal_code");
        const city = part("locality") || part("postal_town");

        onSelectRef.current({ street, postcode, city });
      });
    }

    if (window.google?.maps?.places) {
      attach();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", attach);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", attach);
        listener?.remove();
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = attach;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [apiKey]);

  return inputRef;
}
