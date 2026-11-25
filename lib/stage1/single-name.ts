/**
 * QA: "I'd pick Servant because Walton put associates first" names a leader with one word.
 * A lone capitalized name counts when it is mid-sentence, isn't a style, reading, place or
 * company word, and is doing something a person does ("Walton put…", "Nadella's…").
 */
const NOT_SINGLE =
  /^(?:I|I'm|I'd|I've|I'll|The|This|That|These|Those|My|Our|Their|His|Her|It|We|They|He|She|You|Chapter|Northouse|Goleman|Leadership|Theory|Practice|What|Makes|Leader|Leaders|HBR|APA|MLA|Prof|Professor|Dr|Ms|Mr|Mrs|Using|Because|And|But|So|Or|If|When|Then|Also|Transformational|Transactional|Situational|Servant|Behavioral|Authentic|Democratic|Autocratic|Laissez|Charismatic|Adaptive|Emotional|Intelligence|Harvard|Business|Review|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Microsoft|Apple|Google|Amazon|Walmart|PepsiCo|Pepsi|Tesla|Starbucks|Netflix|Nike|Disney|Ford|Toyota|Boeing|Intel|IBM|Meta|Facebook|America|American|English|Stage|Paragraph|Introduction|Conclusion|Body|Part|Option|Style)$/;
const PERSON_VERB =
  /^(?:'s|’s|put|puts|led|leads|did|does|made|makes|turned|turns|changed|changes|built|builds|treated|treats|listened|listens|showed|shows|kept|keeps|gave|gives|told|tells|inspired|inspires|said|says|was|is|had|has|took|takes|got|gets|cared|cares|asked|asks|trusted|trusts|pushed|pushes|focused|focuses|valued|values|stayed|stays|wanted|wants|believed|believes|served|serves|empowered|empowers|rallied|rallies|helped|helps|worked|works|started|founded|ran|runs|visited|visits|shared|shares|grew|grows|paid|pays|met|meets|knew|knows|went|goes|came|comes|wrote|writes|spoke|speaks|chose|chooses|brought|brings|taught|teaches|sat|sits|let|lets|found|finds)$/i;

export function singleNamedLeader(text: string): string | null {
  for (const m of text.matchAll(/(^|[^.!?]\s)([A-Z][a-z-]{3,})(['’]s\b)?/g)) {
    const name = m[2]!;
    if (!m[1] || NOT_SINGLE.test(name)) continue; // never the first word of the text or a sentence
    const after = text.slice((m.index ?? 0) + m[0].length).trimStart();
    const next = m[3] ? "'s" : (after.split(/\s+/)[0] ?? "").replace(/[^A-Za-z'’]/g, "");
    // QA round 5 (Walton re-ask): any past-tense action counts ("Walton visited stores", "shared profits").
    if (PERSON_VERB.test(next) || (/^[a-z]{3,}ed$/.test(next) && !/^(?:based|called|named|used|related|focused)$/.test(next))) return name;
  }
  return null;
}
