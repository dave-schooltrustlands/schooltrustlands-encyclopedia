export type WritingBook = {
  slug: string;
  title: string;
  kicker: string;
  byline: string;
  blurb: string;
  status: string;
  fit: string;
  currentHref?: string;
  draftHref?: string;
  ctaLabel?: string;
  draftLabel?: string;
};

export const writingBooks: WritingBook[] = [
  {
    slug: 'school-trust-rebirth',
    title: 'The Rebirth of America\'s School Trusts',
    kicker: 'Roadmap brief',
    byline: 'Dave Sullivan, with AI-agent drafting and source support',
    blurb:
      'The roles-and-roadmap brief for making school trusts visible, enforceable, and worth fighting for. It explains why the Library, OASTL, ASTL, the public websites, and the publication family are different parts of one larger rebirth effort.',
    status:
      'Working public draft. Not approved by any organization; ready for friends and close reviewers to inspect.',
    fit:
      'The framing document. It tells a reader what the convoy is, why Oregon matters first, and how the books and websites fit together.',
    draftHref: '/drafts/school-trust-rebirth-latest.docx',
    draftLabel: 'Open latest Word draft',
  },
  {
    slug: 'how-the-library-works',
    title: 'How the Library Works',
    kicker: 'Alignment booklet',
    byline: 'Dave Sullivan and America\'s School Trust Library',
    blurb:
      'A plain-language explanation of the Library as a working system: the source record, the public surfaces, the correction method, and the roles people can take.',
    status:
      'Working alignment draft. The concept is public-facing; final form is still being tuned.',
    fit:
      'The orientation door. It helps boards, collaborators, and first readers understand the method before judging the products.',
    currentHref: '/how-the-library-works/',
    ctaLabel: 'Open the web version',
  },
  {
    slug: 'forgotten-forever-gift',
    title: 'The Forgotten Forever Gift to Public Schools',
    kicker: 'Book 02 - past',
    byline: 'Margaret Bird and Dave Sullivan',
    blurb:
      'How the United States built, kept, and largely lost a national endowment for public education, followed by a state-by-state portrait of the trust.',
    status:
      'Coauthor review and verification work continue; the latest draft uses the Library citation system.',
    fit:
      'The historical anchor. It gives the rebirth effort its national memory and factual spine.',
    currentHref: '/writing/schools-of-the-republic/',
    draftHref: '/drafts/schools-of-the-republic-latest.docx',
  },
  {
    slug: 'law-that-says-nothing-new',
    title: 'A Law That Says Nothing New',
    kicker: 'Book 03 - public repair',
    byline: 'America\'s School Trust Library',
    blurb:
      'A public-facing explanation of the proposed model state law for enforcing school-trust duties that already exist.',
    status:
      'Working public draft. It should be read as public-consideration material, not legal advice or filed legislation.',
    fit:
      'The citizen-and-legislator bridge. It explains the enforcement repair without making readers start in legal machinery.',
    draftHref: '/drafts/a-law-that-says-nothing-new-latest.docx',
    draftLabel: 'Open latest Word draft',
  },
  {
    slug: 'uptea-for-lawyers',
    title: 'UPTEA for Lawyers and Legislative Counsel',
    kicker: 'Book 04 - legal instrument',
    byline: 'Drafting lane under development',
    blurb:
      'The lawyer-facing version of the model enforcement act: text, commentary, adoption issues, standing, remedies, and counsel questions.',
    status:
      'Working lane. The current linked packet is a convergence draft, not a finished legal manual.',
    fit:
      'The enactment instrument. It is where public aspiration becomes statutory language lawyers can test.',
    draftHref: '/drafts/uptea-converged-packet-latest.docx',
    draftLabel: 'Open current packet',
  },
  {
    slug: 'case-waiting-for-you',
    title: 'The Case That\'s Waiting for You',
    kicker: 'Book 05 - lawyer recruitment',
    byline: 'America\'s School Trust Library',
    blurb:
      'A recruitment booklet for lawyers who can help turn a neglected fiduciary field into an enforceable one.',
    status:
      'Planned public-facing booklet. The card is live so the lane is visible while the draft is assembled.',
    fit:
      'The pro bono door. It converts legal curiosity into bounded work: review, verify, write, or take a role.',
  },
  {
    slug: 'help-us-keep-the-books',
    title: 'Help Us Keep the Books',
    kicker: 'Book 06 - librarian recruitment',
    byline: 'America\'s School Trust Library',
    blurb:
      'A booklet for librarians, archivists, researchers, and careful readers who can help keep the source record clean.',
    status:
      'Planned public-facing booklet. The card is live so source-work volunteers can see the role forming.',
    fit:
      'The stewardship door. It turns watchfulness into named record-keeping work.',
  },
  {
    slug: 'stewards-of-the-republic',
    title: 'Stewards of the Republic',
    kicker: 'Book 07 - future',
    byline: 'Dave Sullivan',
    blurb:
      'What the long school-trust record teaches people designing and governing future long-term institutions, including AI-era trusts.',
    status:
      'Development draft posted with known issues disclosed; correction and verification work continue.',
    fit:
      'The forward anchor. It carries the school-trust lessons to the people designing the next forever institutions.',
    currentHref: '/writing/stewards-of-the-republic/',
    draftHref: '/drafts/stewards-of-the-republic-latest.docx',
  },
  {
    slug: 'school-trust-lands-hornbook',
    title: 'School Trust Lands: The Law of America\'s Educational Land Trusts',
    kicker: 'Book 08 - legal reference',
    byline: 'America\'s School Trust Library',
    blurb:
      'The field\'s one-volume legal reference: grants, fiduciary duties, standing, accounting, remedies, and reform.',
    status:
      'Working edition. A standing verification program checks quotations and citations against primary sources.',
    fit:
      'The legal spine. It lets every public-facing book point back to the law without overloading ordinary readers.',
    currentHref: '/writing/hornbook/',
    draftHref: '/drafts/hornbook-working-edition-v1.docx',
    ctaLabel: 'Open the hornbook',
    draftLabel: 'Open working edition',
  },
  {
    slug: 'trustees-handbook',
    title: 'The Trustee\'s Handbook',
    kicker: 'Book 09 - constructive practice',
    byline: 'America\'s School Trust Library',
    blurb:
      'A constructive guide for public officials responsible for school assets: what good trust practice looks like and how to prove it.',
    status:
      'Planned public-facing handbook for trustee and conference audiences.',
    fit:
      'The constructive lane. It gives responsible officials a way to be credited for doing the work right.',
  },
  {
    slug: 'who-steals-from-children',
    title: 'Who Steals from Children',
    kicker: 'Book 10 - present record',
    byline: 'Edited by Dave Sullivan',
    blurb:
      'The living state-by-state record of the fight for America\'s school trust lands, beginning from Oregon and broadening nationally.',
    status:
      'Living draft; updated as the litigation and state records grow.',
    fit:
      'The field record. It gathers the present-tense stories that show why the repair is needed.',
    currentHref: '/writing/who-steals-from-children/',
    draftHref: '/drafts/who-steals-from-children-vol1-latest.docx',
  },
  {
    slug: 'useful-life',
    title: 'A Useful Life',
    kicker: 'Book 11 - formation story',
    byline: 'Dave Sullivan',
    blurb:
      'Dave\'s formation story: systems work, publishing, tree-farm life, and the habits that made the school-trust project possible.',
    status:
      'Working public-facing autobiographical booklet.',
    fit:
      'The witness door. It explains why this work is being carried by this particular citizen at this particular moment.',
    draftHref: '/drafts/a-useful-life-latest.docx',
    draftLabel: 'Open latest Word draft',
  },
  {
    slug: 'accidental-plaintiff',
    title: 'The Accidental Plaintiff',
    kicker: 'Book 12 - Oregon origin',
    byline: 'Dave Sullivan',
    blurb:
      'The origin story of the Oregon lawsuits: lookout tower, public-records fights, ElliottSecrets, pro se filing, and the grandchildren case.',
    status:
      'Working public-facing Oregon-origin booklet.',
    fit:
      'The Oregon door. It gives the national repair program a human starting point and a reason to care.',
    draftHref: '/drafts/the-accidental-plaintiff-latest.docx',
    draftLabel: 'Open latest Word draft',
  },
  {
    slug: 'make-school-trusts-for-schools',
    title: 'Make School Trusts for Schools',
    kicker: 'Citizen repair packet',
    byline: 'Oregon Advocates for School Trust Lands',
    blurb:
      'A public-consideration booklet and packet for Oregon voters, legislators, parents, students, lawyers, librarians, and school advocates.',
    status:
      'Working public-consideration material. Not authorized for filing or signature gathering.',
    fit:
      'The democratic fallback. It lets the public see what a school-trust repair measure could look like before crisis timing forces haste.',
    draftHref: '/drafts/make-school-trusts-for-schools-latest.docx',
    draftLabel: 'Open latest Word booklet',
  },
];

export function getWritingBook(slug: string): WritingBook | undefined {
  return writingBooks.find((book) => book.slug === slug);
}
