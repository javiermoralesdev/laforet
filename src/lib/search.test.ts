import { describe, it, expect } from "vitest";
import { filterEntriesByTitle, type EntrySummary } from "./ListEntries";

describe("filterEntriesByTitle - Client-side Title Search", () => {
    const sampleEntries: EntrySummary[] = [
        { id: "1", title: "A quiet morning in the forest", created: "2026-11-10T08:00:00Z" },
        { id: "2", title: "Café de Paris & travel memories", created: "2026-11-11T09:30:00Z" },
        { id: "3", title: "Reflexiones sobre la vida", created: "2026-11-12T14:15:00Z" },
        { id: "4", title: "Canción de cuna y versos", created: "2026-11-13T18:45:00Z" },
        { id: "5", title: "La Forêt en otoño", created: "2026-11-14T20:00:00Z" },
        { id: "6", title: "🔒 [Decryption Error]", created: "2026-11-15T22:10:00Z" },
    ];

    it("returns all entries when query is empty or whitespace", () => {
        expect(filterEntriesByTitle(sampleEntries, "")).toEqual(sampleEntries);
        expect(filterEntriesByTitle(sampleEntries, "   ")).toEqual(sampleEntries);
    });

    it("matches titles case-insensitively", () => {
        const results = filterEntriesByTitle(sampleEntries, "QUIET");
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("1");

        const results2 = filterEntriesByTitle(sampleEntries, "reflexiones");
        expect(results2).toHaveLength(1);
        expect(results2[0].id).toBe("3");
    });

    it("matches titles with accents and diacritics regardless of input accents", () => {
        // Query without accents matches title with accents
        const resultsNoAccent = filterEntriesByTitle(sampleEntries, "cancion");
        expect(resultsNoAccent).toHaveLength(1);
        expect(resultsNoAccent[0].id).toBe("4");

        // Query with accents matches title with accents
        const resultsWithAccent = filterEntriesByTitle(sampleEntries, "canción");
        expect(resultsWithAccent).toHaveLength(1);
        expect(resultsWithAccent[0].id).toBe("4");

        // Query with accent matches title without accent
        const cafeSearch = filterEntriesByTitle(sampleEntries, "cafe");
        expect(cafeSearch).toHaveLength(1);
        expect(cafeSearch[0].id).toBe("2");

        // French circumflex: 'foret' matches 'forest' (by substring) and 'La Forêt'
        const foretSearch = filterEntriesByTitle(sampleEntries, "foret");
        expect(foretSearch.map(e => e.id)).toContain("5");
    });

    it("supports multi-word searches in any order", () => {
        const results = filterEntriesByTitle(sampleEntries, "memories Paris");
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("2");

        const resultsReversed = filterEntriesByTitle(sampleEntries, "Paris café");
        expect(resultsReversed).toHaveLength(1);
        expect(resultsReversed[0].id).toBe("2");
    });

    it("returns empty array when no title matches", () => {
        const results = filterEntriesByTitle(sampleEntries, "nonexistent title query");
        expect(results).toEqual([]);
    });

    it("matches special characters like decryption error fallback titles", () => {
        const results = filterEntriesByTitle(sampleEntries, "decryption error");
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("6");
    });

    it("safely handles empty input array", () => {
        expect(filterEntriesByTitle([], "test")).toEqual([]);
    });
});
