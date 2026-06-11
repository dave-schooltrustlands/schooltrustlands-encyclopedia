// Site-wide configuration flags.
//
// SITE_PREVIEW — board-adoption switch for the whole public Library site.
// Keep true until Dave authorizes the post-organizational-meeting flip. When
// false, the sitewide Preview strip is replaced by a Living Edition label.
export const SITE_PREVIEW = true;

// PREPUBLICATION — when true, every Reading Room chapter page renders
// the <PrepublicationBanner /> warning at the top of the chapter content
// area. This is separate from SITE_PREVIEW: a board-adopted Library can still
// carry visible draft notices on individual book chapters.
export const PREPUBLICATION = true;
