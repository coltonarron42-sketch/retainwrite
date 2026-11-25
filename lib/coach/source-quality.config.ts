/**
 * PC-31 QA 3:46: which sites Pau may cite. Students cite what Pau gives them, so this list is the
 * feature's core. Maintain it here (suffix match on the host: "sagepub.com" covers journals.sagepub.com).
 *
 * Tier 3 (preferred): peer-reviewed journals and academic publishers, HBR and business-school
 *   research outlets, major news.
 * Tier 2 (fine): .gov, accredited university course or library pages (not .edu marketing blogs or
 *   PDF dumps), recognized research orgs, a company's own site (only for a bullet about that company).
 * Tier 1 (not cited): anything else (blogs, SaaS marketing, listicles).
 * Tier 0 (blocked, never used): content farms, summary services, essay mills, study-help sites,
 *   pirated-PDF and document-dump hosts.
 */
export const SOURCE_QUALITY = {
  strong: [
    // journals and academic publishers
    "sagepub.com", "springer.com", "wiley.com", "jstor.org", "tandfonline.com", "sciencedirect.com", "elsevier.com",
    "emerald.com", "oup.com", "cambridge.org", "routledge.com", "apa.org", "nih.gov", "nature.com", "science.org",
    "frontiersin.org", "plos.org", "mdpi.com", "informs.org", "aom.org", "jbs.cam.ac.uk", "doi.org", "scholar.archive.org",
    "pearson.com", "mheducation.com", "cengage.com", "norton.com",
    // business research outlets
    "hbr.org", "hbs.edu", "sloanreview.mit.edu", "mitsloan.mit.edu", "knowledge.wharton.upenn.edu", "gsb.stanford.edu",
    "kellogg.northwestern.edu", "insead.edu", "ccl.org", "mckinsey.com", "gallup.com", "bcg.com", "deloitte.com", "pewresearch.org",
    // major news
    "nytimes.com", "wsj.com", "ft.com", "economist.com", "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "npr.org",
    "theguardian.com", "washingtonpost.com", "bloomberg.com", "cnbc.com", "fortune.com", "forbes.com", "theatlantic.com",
    "time.com", "latimes.com", "usatoday.com", "businessinsider.com", "axios.com", "pbs.org", "cbsnews.com", "nbcnews.com", "abcnews.go.com",
  ],
  fine: [
    // recognized research and professional orgs
    "greenleaf.org", "shrm.org", "brookings.edu", "rand.org", "oecd.org", "worldbank.org", "who.int", "un.org", "britannica.com",
  ],
  blocked: [
    // content farms, summary services, listicle and "examples" sites
    "shortform.com", "helpfulprofessor.com", "strategypunk.com", "jointhecollective.com", "peoplemanagingpeople.com",
    "blinkist.com", "getabstract.com", "sorryonmute.com", "modernservantleader.com", "toolshero.com", "mindtools.com",
    "verywellmind.com", "simplypsychology.org", "corporatefinanceinstitute.com", "investopedia.com", "masterclass.com",
    "indeed.com", "betterup.com", "asana.com", "hubspot.com", "wikihow.com", "medium.com", "linkedin.com", "quora.com", "reddit.com",
    "sketchbubble.com", "slidemodel.com", "examples.com", "yourdictionary.com", "leadershipahoy.com", "status.net", "valamis.com",
    // essay mills and study help
    "coursehero.com", "studocu.com", "ukessays.com", "ivypanda.com", "bartleby.com", "gradesaver.com", "sparknotes.com", "cliffsnotes.com",
    "studycorgi.com", "edubirdie.com", "papersowl.com", "essaypro.com", "123helpme.com", "antiessays.com", "chegg.com", "quizlet.com",
    "brainly.com", "studylib.net", "studymoose.com", "gradesfixer.com", "writix.com", "essaysauce.com", "phdessay.com", "nerdyseal.com",
    "academia.edu", "scribd.com", "slideshare.net", "issuu.com", "yumpu.com", "fliphtml5.com", "anyflip.com", "pdfslide.net",
    // pirated PDFs and document dumps
    "libgen", "z-lib", "zlibrary", "z-library", "singlelogin", "1lib", "b-ok", "pdfdrive", "pdfroom", "dokumen.pub", "vdoc.pub", "ebin.pub",
    "epdf.pub", "epdf.tips", "pdfcoffee", "doku.pub", "idoc.pub", "annas-archive", "sci-hub", "freebookspot", "ebookee",
  ],
  /** .edu pages that are program marketing, not course or library pages. */
  eduMarketingHost: /^(?:online|degrees?|programs?|admissions?|blog|onlinedegrees?|graduate-?online)\./i,
  /** A PDF on a library/repository host that isn't the publisher is treated as a pirated textbook copy. */
  libraryHost: /^(?:e?library|lib|repository|repo|dspace|eprints?|elib|digilib|ebooks?|files|docs|uploads?)\./i,
  /** Friendly names for inline attribution. */
  names: {
    "hbr.org": "Harvard Business Review", "sloanreview.mit.edu": "MIT Sloan Management Review", "journals.sagepub.com": "a SAGE journal",
    "sagepub.com": "SAGE", "link.springer.com": "Springer", "onlinelibrary.wiley.com": "Wiley", "jstor.org": "JSTOR",
    "tandfonline.com": "Taylor & Francis", "sciencedirect.com": "ScienceDirect", "hbs.edu": "Harvard Business School",
    "knowledge.wharton.upenn.edu": "Knowledge at Wharton", "gsb.stanford.edu": "Stanford GSB", "ccl.org": "the Center for Creative Leadership",
    "mckinsey.com": "McKinsey", "gallup.com": "Gallup", "nytimes.com": "The New York Times", "wsj.com": "The Wall Street Journal",
    "ft.com": "the Financial Times", "economist.com": "The Economist", "reuters.com": "Reuters", "apnews.com": "AP News", "bbc.com": "BBC",
    "npr.org": "NPR", "theguardian.com": "The Guardian", "washingtonpost.com": "The Washington Post", "bloomberg.com": "Bloomberg",
    "cnbc.com": "CNBC", "fortune.com": "Fortune", "forbes.com": "Forbes", "greenleaf.org": "the Greenleaf Center", "shrm.org": "SHRM",
    "britannica.com": "Britannica", "apa.org": "the APA", "emerald.com": "Emerald",
    "frontiersin.org": "Frontiers", "mdpi.com": "MDPI", "academic.oup.com": "Oxford Academic", "cambridge.org": "Cambridge",
  } as Record<string, string>,
} as const;
