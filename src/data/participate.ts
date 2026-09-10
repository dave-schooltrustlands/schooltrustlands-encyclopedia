// The Participate section — the Library's September 2026 shelf of documents.
//
// Each entry names a piece rendered by the Library Shelf renderer. The web
// text lives beside this file in `participate/<slug>.html` (the renderer's
// `<main class="flow">`, with the print furniture removed); the two PDFs live
// in `public/participate/`.
//
// `description` is the piece's own opening, verbatim. Nothing here is written
// for the web page: a description that made a claim the document does not
// make would be a claim the Library has not checked.
//
// `pages` is the piece's content-page count from the renderer's layout report
// of September 8, 2026; reading time is that count times 1.5 minutes.

export interface ShelfDoc {
  slug: string;
  title: string;
  /** the renderer's own body classes, carried onto the .shelf-doc container */
  bodyClass: string;
  /** content pages, from the renderer's layout report */
  pages: number;
  /** the piece's own opening, verbatim */
  description: string;
  /** the same words, shortened, for the index card */
  blurb: string;
  /** a card in the Ways to Help family rather than a document of its own */
  card?: boolean;
  /**
   * Dated editor's notes shown above the text. A numbered edition is not
   * silently rewritten (Constitution, Article VII); when events overtake a
   * sentence, the note says so and the sentence stands.
   */
  notes?: { date: string; html: string }[];
}

export const READING_MINUTES_PER_PAGE = 1.5;

export function readingMinutes(pages: number): number {
  return Math.round(pages * READING_MINUTES_PER_PAGE);
}

export const DOCS: ShelfDoc[] = [
  {
    slug: 'six-months-of-a-library',
    title: 'Six Months of a Library',
    bodyClass: 'kind-report layout-text',
    pages: 15,
    description:
      'This report is the Library’s account of its first six months, February 20 to September 7, 2026. It is a record, not a case. Every count carries the date it was taken, and where the Library has been wrong it says so, with the number it put on the mistake.',
    blurb:
      'The Library’s account of its first six months, February 20 to September 7, 2026. A record, not a case.',
  },
  {
    slug: 'the-next-three-years',
    title: 'The Next Three Years',
    bodyClass: 'kind-plan layout-text',
    pages: 20,
    description:
      'This plan covers 2027, 2028 and 2029. It is for the Library’s board, which may adopt, amend or set it aside; and for anyone outside who would rather judge the Library by something it can fail than by the way it describes itself. Every figure here is a planning assumption until the board adopts a budget. Where a number rests on an estimate the sentence says so; where the record holds no number, this plan says that instead of supplying one.',
    blurb:
      'A plan for 2027, 2028 and 2029, for anyone who would rather judge the Library by something it can fail than by the way it describes itself.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Two things this plan describes as pending have since happened. The board acted by unanimous written consent on September 10, 2026 — adopting this plan and its companions as Version 1, directing the federal filing, and directing that the presidency pass from the founder by December 31, 2027; its two directors with no interest in either advocacy organization accepted the alliance with Oregon Advocates for School Trust Lands on the Library’s side, the founder taking no part — and the postings for the three open seats this plan says were not yet published were published on September 10, 2026 at <a href="/participate/open-seats/">Open seats</a>. The text below stands as adopted; the <a href="/organizing/">organizational record</a> carries the action.',
      },
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
  {
    slug: 'a-record-with-a-keeper',
    title: 'A Record With a Keeper',
    bodyClass: 'kind-booklet layout-text',
    pages: 20,
    description:
      'This is a case, not a solicitation. America’s School Trust Library has not opened a bank account, and until it does it is not asking anyone for money. What follows is the other half of the transaction, written first. How to give will be posted when the Library’s account is open. There is no envelope in this booklet.',
    blurb:
      'A case, not a solicitation. The Library has not opened a bank account, and until it does it is not asking anyone for money.',
  },
  {
    slug: 'ways-to-help',
    title: 'Ways to Help',
    bodyClass: 'kind-booklet layout-text',
    pages: 23,
    description:
      'America’s School Trust Library keeps the public record of America’s school lands — freely, neutrally, and permanently. It is not asking you for money. It asks for documents and hands. Five ways in: librarians and archivists · lawyers · legislators, trustees and agency staff · teachers · families and historians who hold records.',
    blurb:
      'It is not asking you for money. It asks for documents and hands. Five ways in, and how to say yes to each.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
  {
    slug: 'how-a-collection-comes-in',
    title: 'How a Collection Comes In',
    bodyClass: 'kind-booklet layout-text',
    pages: 12,
    description:
      'America’s School Trust Library is an Oregon nonprofit public benefit corporation, Oregon Registry No. 259005891, incorporated July 21, 2026. It keeps the documentary record of America’s school trust lands — the land Congress granted each new state to support its public schools, and the permanent funds that land feeds. Much of that record was never in an archive: it sits in basements, filing cabinets and aging websites, and when the person who kept it dies, most of it goes too. What follows is one collection arriving, dated so it can be checked, and it includes the parts that went badly.',
    blurb:
      'One collection arriving, dated so it can be checked — and it includes the parts that went badly.',
  },
  {
    slug: 'six-months-of-a-library-the-timeline',
    title: 'Six Months of a Library — the timeline',
    bodyClass: 'kind-card layout-card',
    pages: 4,
    description:
      'The order matters more than the count. The site opened on April 29 and the Library was named on May 3, but it was not incorporated until July 21 and had no board until August 3: the corporation was built around work that already existed.',
    blurb:
      'Three tracks against one calendar, February 20 to September 7, 2026, on four pages.',
  },
  {
    slug: 'for-librarians-and-archivists',
    title: 'For Librarians and Archivists',
    bodyClass: 'kind-card layout-card',
    pages: 4,
    card: true,
    description:
      'The gap, stated plainly. The Library’s catalog held 72 holdings on August 10, 2026, and not one of them carried the label Verified — including the ones its own founders wrote. A data point on a state page may carry a Verified badge for that figure; the catalog’s Verified label, for a whole holding checked by a second reader, has not yet been earned by any holding.',
    blurb: 'The gap, stated plainly, and the shelves that need a keeper.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
  {
    slug: 'for-lawyers',
    title: 'For Lawyers',
    bodyClass: 'kind-card layout-card',
    pages: 4,
    card: true,
    description:
      'The law of this field is not gathered anywhere. It is old and settled in its main lines, and a lawyer who wants to read it has to reconstruct it from six decisions of the United States Supreme Court spanning 137 years, the enabling acts and constitutional clauses of roughly twenty states, and a century of state cases that nobody has ever put in one place.',
    blurb: 'The law of this field is not gathered anywhere. The Library is gathering it.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
  {
    slug: 'for-legislators-trustees-and-agency-staff',
    title: 'For Legislators, Trustees and Agency Staff',
    bodyClass: 'kind-card layout-card',
    pages: 4,
    card: true,
    description:
      'Your state’s page is your state’s record. You are among the people who already hold this record. The Library asks two things of you, and neither is a position. Read what it says about your state. Tell it what it has wrong.',
    blurb: 'Read what the Library says about your state. Tell it what it has wrong.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
  {
    slug: 'for-teachers',
    title: 'For Teachers',
    bodyClass: 'kind-card layout-card',
    pages: 4,
    card: true,
    description:
      'The oldest school-funding decision in American history is a shape on a map. And it is probably within a few miles of your classroom.',
    blurb: 'The oldest school-funding decision in American history is a shape on a map.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
  {
    slug: 'for-families-and-historians-who-hold-records',
    title: 'For Families and Historians Who Hold Records',
    bodyClass: 'kind-card layout-card',
    pages: 4,
    card: true,
    description:
      'Somebody in your family kept the papers. A career’s worth of field notes; agency reports from an office that no longer exists; interviews on cassette; a shelf of printed monographs; photographs with names on the back. Those files do not survive a move, a failed drive, or a funeral. This is not a failure of care. It is the ordinary fate of a record with no keeper.',
    blurb: 'Somebody in your family kept the papers. What happens to them next.',
    notes: [
      {
        date: 'September 10, 2026',
        html: 'Replies about the three open seats go to the President, Dave Sullivan, at <a href="mailto:drdavesullivan@gmail.com">drdavesullivan@gmail.com</a>, not to the Secretary as this edition says; the change was made September 10, 2026 and the postings at <a href="/participate/open-seats/">Open seats</a> carry it.',
      },
    ],
  },
];

export const CARDS = DOCS.filter((d) => d.card);
export const DOCUMENTS = DOCS.filter((d) => !d.card);

export const COLOPHON =
  'Drafted with an AI system for the Library’s board, from the Library’s own record, and checked against that record by people. Version 1, September 2026.';
