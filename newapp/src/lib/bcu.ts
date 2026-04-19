import type { Book, Faculty } from "../types";

const LIBRARY_BASE_URL = "https://public-view.bcucluj.ro/pdfview/";
const DSPACE_OAI_BASE_URL = "https://dspace.bcucluj.ro/oai/request";

const SEARCH_CACHE_PREFIX = "bcu_react_index_v9_";
const OAI_CACHE_KEY = "bcu_react_oai_fallback_v9";
const OAI_SETS_CACHE_KEY = "bcu_react_oai_sets_v1";
const SEARCH_CACHE_TTL = 1000 * 60 * 60 * 12;
const INDEX_CONCURRENCY = 2;
const BATCH_DELAY_MS = 450;
const OAI_MAX_PAGES = 40;
const OAI_MAX_RECORDS = 4000;

const FACULTY_LABEL_OVERRIDES: Record<string, string> = {
  DREPT: "Drept",
  EDFIZ: "Educatie Fizica si Sport",
  FIZIC: "Fizica",
  GEOGR: "Geografie",
  IST: "Istorie si Filosofie",
  FILO: "Litere",
  MATE: "Matematica si Informatica",
  PED: "Psihologie si Stiinte ale Educatiei",
  SOCAS: "Sociologie si Asistenta Sociala",
  MEDIU: "Stiinta si Ingineria Mediului",
  EC: "Stiinte Economice si Gestiunea Afacerilor",
  MED: "Stiinte Medicale si ale Sanatatii",
  STPOL: "Stiinte Politice, Administrative si ale Comunicarii",
  SE: "Studii Europene",
  TEATR: "Teatru si Film",
  TEOIG: "Teologie Greco Catolica",
  TEOIO: "Teologie Ortodoxa",
  TEOLRF: "Teologie Reformata",
  TEORC: "Teologie Romano Catolica"
};

const STATIC_FACULTY_NAMES = [
  "Drept",
  "Educatie Fizica si Sport",
  "Fizica",
  "Geografie",
  "Istorie si Filosofie",
  "Litere",
  "Matematica si Informatica",
  "Psihologie si Stiinte ale Educatiei",
  "Sociologie si Asistenta Sociala",
  "Stiinta si Ingineria Mediului",
  "Stiinte Economice si Gestiunea Afacerilor",
  "Stiinte Medicale si ale Sanatatii",
  "Stiinte Politice, Administrative si ale Comunicarii",
  "Studii Europene",
  "Teatru si Film",
  "Teologie Greco Catolica",
  "Teologie Ortodoxa",
  "Teologie Reformata",
  "Teologie Romano Catolica"
];

// Official UBB specialization names per faculty (source: ubb.ro registration portal).
// Used to validate folder-based department names — folders that don't match a known
// specialization fall back to "General" instead of showing archival subject noise.
const FACULTY_DEPARTMENTS: Record<string, string[]> = {
  "Drept": [
    "Drept", "Dreptul european si dreptul national al afacerilor",
    "Dreptul International si Comparat al Afacerilor",
    "Dreptul privat al Uniunii Europene", "Institutii de drept privat",
    "International and comparative business law",
    "Stiinte penale si criminalistica"
  ],
  "Educatie Fizica si Sport": [
    "Antrenament si performanta sportiva",
    "Educatie fizica si agrement in turism", "Educatie fizica si sport",
    "Kinetoterapie in afectiunile aparatului locomotor",
    "Kinetoterapie si motricitate speciala",
    "Managementul organizatiilor si activitatilor sportive",
    "Sport si performanta motrica"
  ],
  "Fizica": [
    "Fizica", "Fizica informatica", "Fizica medicala", "Fizica tehnologica"
  ],
  "Geografie": [
    "Amenajare si dezvoltare turistica", "Cartografie", "Geografia turismului",
    "Geografie", "Geomatica", "Hidrologie si meteorologie",
    "Planificare si dezvoltare regionala", "Planificare teritoriala",
    "Resurse si riscuri in mediul hidroatmosferic",
    "Turism si dezvoltare teritoriala"
  ],
  "Istorie si Filosofie": [
    "Arheologie", "Arheologie si studii clasice", "Arhivistica",
    "Cercetarea si valorificarea patrimoniului cultural", "Etnologie",
    "Evaluarea politicilor si a programelor publice europene",
    "Filosofie", "Filosofie antica si medievala", "Filosofie, cultura, comunicare",
    "Istoria artei", "Istoria Europei de sud-est",
    "Istoria si socio-antropologia epocii moderne",
    "Istorie", "Istorie antica", "Istorie contemporana",
    "Istorie contemporana si relatii internationale",
    "Istorie medievala", "Istorie moderna",
    "Istorie, memorie, oralitate in sec. XX",
    "Leadership si comunicare in organizatii internationale",
    "Managementul securitatii in societatea contemporana",
    "Patrimoniu si turism cultural", "RISE",
    "Securitate, Intelligence si competitivitate in organizatii",
    "Societate, arta, identitati in Europa Centrala. De la medieval la modernitate",
    "Stiinte ale informarii si documentarii", "Studii de securitate",
    "Studii iudaice", "Teorie critica si studii multiculturale", "Turism cultural"
  ],
  "Litere": [
    "Etnografie si antropologie maghiara", "Filologie clasica",
    "Limba si literatura chineza", "Limba si literatura coreeana",
    "Limba si literatura engleza", "Limba si literatura finlandeza",
    "Limba si literatura franceza", "Limba si literatura germana",
    "Limba si literatura italiana", "Limba si literatura japoneza",
    "Limba si literatura maghiara", "Limba si literatura norvegiana",
    "Limba si literatura portugheza", "Limba si literatura romana",
    "Limba si literatura rusa", "Limba si literatura spaniola",
    "Limba si literatura ucraineana", "Limbi moderne aplicate",
    "Literatura universala si comparata",
    "Scoala Doctorala Studii de Hungarologie",
    "Studii culturale", "Studii si cercetari est-asiatice",
    "Trunchi comun - MA", "Trunchi comun - RO"
  ],
  "Matematica si Informatica": [
    "Informatica", "Matematica", "Matematica informatica", "UBB_Matematica"
  ],
  "Psihologie si Stiinte ale Educatiei": [
    "Consiliere scolara si asistenta psihopedagogica",
    "Consiliere si interventie psihologica in dezvoltarea umana",
    "Consultanta si interventie psihologica", "Designer instructional",
    "Didactica limbii si literaturii germane, cultura si civilizatia germana a Europei Centrale si de sud Est",
    "Management curricular", "Management educational",
    "Management, consiliere si asistenta psihopedagogica in institutiile incluzive",
    "Metode si practici alternative in invatamantul primar si prescolar",
    "Pedagogia Invatamantului primar si prescolar", "Pedagogie",
    "Psihologia resurselor umane si sanatate organizationala",
    "Psihologia sanatatii publice si clinica", "Psihologie",
    "Psihologie clinica, consiliere psihologica si psihoterapie",
    "Psihologie judiciara", "Psihopedagogie speciala",
    "Strategii de invatare eficienta",
    "Tehnici psihologice pentru controlul comportamentului si dezvoltarea potentialului uman",
    "Terapia limbajului si audiologie educationala"
  ],
  "Sociologie si Asistenta Sociala": [
    "Analiza datelor complexe", "Antropologie", "Asistenta sociala",
    "Asistenta sociala in spatiul justitiei. Probatiune si mediere",
    "Asistenta sociala si economie sociala",
    "Cercetare sociologica avansata",
    "Comunicare, societate si mass-media",
    "Managementul serviciilor sociale",
    "Managementul strategic al resurselor umane",
    "Masterat european in drepturile copiilor",
    "Munca si Transformari Sociale",
    "Psihologie(Asistenta sociala)", "Resurse umane",
    "Scoala doctorala de sociologie", "Sociologie"
  ],
  "Stiinta si Ingineria Mediului": [
    "Calitatea mediului si surse energetice",
    "Dezvoltare sustenabila si managementul mediului",
    "Evaluarea riscului si securitatea mediului",
    "Geografia mediului", "Gestiunea si protectia mediului",
    "Ingineria mediului", "Ingineria sistemelor biotehnice si ecologice",
    "Ingineria valorificarii deseurilor",
    "Management si audit de mediu", "Stiinta mediului"
  ],
  "Stiinte Economice si Gestiunea Afacerilor": [
    "Administrarea afacerilor",
    "Administrarea afacerilor in turism, comert si servicii",
    "Afaceri internationale", "Agrobusiness",
    "Auditul si managementul financiar al fondurilor europene",
    "Banci si piete de capital",
    "Contabilitate si informatica de gestiune",
    "Contabilitate si informatica de gestiune (Sighet)",
    "Contabilitate si organizatii",
    "Dezvoltare regionala durabila", "Diagnostic si evaluare",
    "E - Business", "Econometrie si statistica aplicata",
    "Economia comertului turismului si serviciilor",
    "Economia firmei", "Economie agroalimentara si a mediului",
    "Economie generala", "Economie si afaceri internationale",
    "Expertiza contabila si audit",
    "Finante corporative - asigurari", "Finante si banci",
    "Fiscalitate", "Gestiune financiara corporativa",
    "Gestiunea si evaluarea proiectelor",
    "Gestiunea si evaluarea proiectelor (la Sighet)",
    "Informatica economica", "International Business Management",
    "Management", "Management contabil, audit si control",
    "Management international", "Managementul afacerilor",
    "Managementul dezvoltarii afacerilor",
    "Managementul dezvoltarii afacerilor - Sfantu Gheorghe",
    "Managementul resurselor umane", "Marketing", "Marketing digital",
    "Modelarea afacerilor si calculul distribuit",
    "Scoala doctorala Stiinte Economice si Gestiunea Afacerilor",
    "Sisteme de asistare a deciziilor economice",
    "Statistica si previziuni economice",
    "Strategii si politici de marketing"
  ],
  "Stiinte Medicale si ale Sanatatii": [
    "Biologie medicala", "Chimie clinica", "Fizica medicala",
    "Health economics", "Inginerie medicala",
    "Kinetoterapie si motricitate speciala", "Stiintele nutritiei"
  ],
  "Stiinte Politice, Administrative si ale Comunicarii": [
    "Administratie publica", "Comunicare si relatii publice",
    "Jurnalism", "Leadership in sectorul public", "Media digitala",
    "Publicitate", "Servicii si politici de sanatate publica",
    "Stiinta datelor sociale", "Stiinte politice", "Studii de conflict"
  ],
  "Studii Europene": [
    "Administratie europeana", "Management",
    "Relatii internationale si studii europene"
  ],
  "Teatru si Film": [
    "Arta scurtmetrajului", "Arta teatrala - Actorie", "Arta teatrala - Regie",
    "Arte Digitale Interactive - Digital Interactive Arts",
    "Arte performative si film", "Artele spectacolului actorie",
    "Artele spectacolului regie", "Cinematografie fotografie media",
    "Filmologie",
    "Management si Antreprenoriat Cultural in limba romana",
    "Productia de film documentar - Documentary Filmmaking",
    "Teatrologie",
    "Teatru Contemporan Actorie si Teatrologie in limba maghiara"
  ],
  "Teologie Greco Catolica": [
    "Fundamente crestine ale identitatii europene", "Teologie biblica",
    "Teologie greco catolica asistenta sociala",
    "Teologie greco catolica didactica", "Teologie greco catolica pastorala",
    "Teologie pastorala in comunitatile ecleziale"
  ],
  "Teologie Ortodoxa": [
    "Arta sacra",
    "Arta sacra- Conservarea, restaurarea si crearea bunurilor culturale",
    "Bioetica - morala, etica si deontologie",
    "Consiliere pastorala si asistenta psihosociala",
    "Doctrina, Hermeneutica si Istorie bisericeasca",
    "Istoria religiilor, geopolitica religiilor monoteiste (crestinism, iudaism, islam)",
    "Ortodoxie romaneasca si viata liturgica",
    "Pastoratie si viata liturgica",
    "Teologie ortodoxa didactica", "Teologie ortodoxa pastorala",
    "Teologie ortodoxa asistenta sociala"
  ],
  "Teologie Reformata": [
    "Mediere interconfesionala si interculturala", "Muzica",
    "Muzica bisericeasca ecumenica", "Teologie - educatie",
    "Teologie aplicata", "Teologie reformata didactica",
    "Teologie-Muzica-Educatie"
  ],
  "Teologie Romano Catolica": [
    "Teologie romano catolica didactica",
    "Teologie romano catolica pastorala"
  ]
};

// Normalize a string for comparison: lowercase + strip diacritics.
function normForCompare(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to resolve a raw BCU folder name to an official UBB specialization for the given
 * faculty. Returns the canonical specialization name on success, "General" if the folder
 * is clearly a non-department entry (ZZ_*, empty), or null if the faculty is not in our
 * static map (caller should use the raw folder name as-is).
 *
 * Matching strategy (in order):
 *   1. Exact match after diacritic/case normalization.
 *   2. Bidirectional substring: handles cases where the BCU folder is an abbreviation
 *      ("Actorie") of the full specialization name ("Arta teatrala - Actorie") or vice
 *      versa. Picks the longest/most specific match to minimise false positives.
 *   3. No match → "General" (archival subject folder in a known-bad faculty).
 */
function resolveKnownDepartment(facultyLabel: string, rawDept: string): string | null {
  const known = FACULTY_DEPARTMENTS[facultyLabel];

  // Faculty not managed by our static map → caller decides.
  if (!known) {
    return null;
  }

  if (!rawDept) {
    return "General";
  }

  // Meta-folders like ZZ_General, ZZ General → treat as General.
  if (/^zz[_\s-]/i.test(rawDept) || normForCompare(rawDept) === "general") {
    return "General";
  }

  const normalized = normForCompare(rawDept);

  // 1. Exact match.
  const exact = known.find((d) => normForCompare(d) === normalized);
  if (exact) {
    return exact;
  }

  // 2. Bidirectional substring — collect all candidates, pick the shortest (most specific).
  const candidates = known.filter((d) => {
    const dn = normForCompare(d);
    return dn.includes(normalized) || normalized.includes(dn);
  });

  if (candidates.length > 0) {
    // Prefer the shortest matching canonical name (avoids over-broad matches).
    return candidates.sort((a, b) => a.length - b.length)[0];
  }

  // 3. No match → archival/subject folder.
  return "General";
}

type DirectoryEntry = {
  name: string;
  path: string;
  isFolder: boolean;
  date: string;
  sizeBytes: number;
};

type CatalogOptions = {
  force?: boolean;
  onProgress?: (current: number, totalApprox: number) => void;
};

const htmlCache = new Map<string, string>();

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function decodeLabel(label: string): string {
  try {
    return decodeURIComponent(label);
  } catch {
    return label;
  }
}

function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr || sizeStr === "-") {
    return 0;
  }

  const normalized = sizeStr.trim().toUpperCase();
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) {
    return 0;
  }

  if (normalized.includes("K")) {
    return value * 1024;
  }
  if (normalized.includes("M")) {
    return value * 1024 * 1024;
  }
  if (normalized.includes("G")) {
    return value * 1024 * 1024 * 1024;
  }
  return value;
}

function normalizeFacultyKey(raw: string): string {
  return decodeLabel(String(raw || "")).trim().replace(/\/$/, "");
}

function canonicalFacultyId(raw: string): string {
  return normalizeFacultyKey(raw).toLowerCase().replace(/\s+/g, " ");
}

function formatDisplayLabel(raw: string): string {
  if (!raw) {
    return "Colectie";
  }

  const byCode = FACULTY_LABEL_OVERRIDES[raw.toUpperCase()];
  if (byCode) {
    return byCode;
  }

  return decodeLabel(raw.replace(/_/g, " "));
}

function buildFacultyPathFromName(name: string): string {
  const safeName = normalizeFacultyKey(name);
  if (!safeName) {
    return ensureTrailingSlash(LIBRARY_BASE_URL);
  }

  return ensureTrailingSlash(new URL(`${encodeURIComponent(safeName)}/`, LIBRARY_BASE_URL).toString());
}

function looksLikeListing(html: string): boolean {
  const text = (html || "").toLowerCase();
  return text.includes("<table") && text.includes("href=");
}

async function fetchDirectoryHtml(url: string): Promise<string> {
  if (htmlCache.has(url)) {
    return htmlCache.get(url) as string;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }

    const response = await fetch(`/api/bcu/html?url=${encodeURIComponent(url)}`, {
      credentials: "include",
      cache: "force-cache"
    });

    if (response.status === 429) {
      console.warn(`[BCU] Rate limited (429) for ${url}. Attempt ${attempt + 1}/4. Retrying...`);
      lastError = new Error(`HTTP 429 (attempt ${attempt + 1})`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    if (!looksLikeListing(html)) {
      throw new Error("Invalid listing content");
    }

    htmlCache.set(url, html);
    return html;
  }

  throw lastError || new Error("Max retries reached");
}

async function fetchRawHtml(url: string): Promise<string> {
  const key = `raw:${url}`;
  if (htmlCache.has(key)) {
    return htmlCache.get(key) as string;
  }

  const response = await fetch(`/api/bcu/html?url=${encodeURIComponent(url)}`, {
    credentials: "include",
    cache: "force-cache"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  if (!html || html.length < 100) {
    throw new Error("HTML response too short");
  }

  htmlCache.set(key, html);
  return html;
}

function parseDirectoryListing(html: string, folderPath: string): DirectoryEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = Array.from(doc.querySelectorAll("table tr"));
  const results: DirectoryEntry[] = [];

  for (const row of rows) {
    const columns = row.querySelectorAll("td");
    if (columns.length < 4) {
      continue;
    }

    const anchor = columns[1].querySelector("a");
    if (!anchor) {
      continue;
    }

    const href = anchor.getAttribute("href") || "";
    const anchorText = (anchor.textContent || "").trim();
    if (!href || anchorText === "Parent Directory" || href.startsWith("?C=")) {
      continue;
    }

    const absolutePath = new URL(href, folderPath).toString();
    const absoluteUrl = new URL(absolutePath);
    const pathnameParts = absoluteUrl.pathname.split("/").filter(Boolean);
    const pathName = decodeLabel(pathnameParts[pathnameParts.length - 1] || anchorText.replace(/\/$/, ""));
    const isFolder = href.endsWith("/") || absoluteUrl.pathname.endsWith("/");
    const name = isFolder ? pathName.replace(/\/$/, "") : pathName;
    const date = (columns[2].textContent || "").trim() || "-";
    const sizeText = (columns[3].textContent || "").trim() || "-";

    results.push({
      name,
      path: isFolder ? ensureTrailingSlash(absolutePath) : absolutePath,
      isFolder,
      date,
      sizeBytes: isFolder ? 0 : parseSizeToBytes(sizeText)
    });
  }

  return results;
}

function parseFacultyOptionsFromRootHtml(html: string): Faculty[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const options = Array.from(doc.querySelectorAll("select option"));
  const faculties: Faculty[] = [];

  for (const option of options) {
    const value = (option.getAttribute("value") || "").trim();
    const text = decodeLabel((option.textContent || "").trim());
    if (!text || /deselecteaza|selecteaza/i.test(text)) {
      continue;
    }

    let label = text;
    if (value && FACULTY_LABEL_OVERRIDES[value.toUpperCase()]) {
      label = FACULTY_LABEL_OVERRIDES[value.toUpperCase()];
    } else if (FACULTY_LABEL_OVERRIDES[text.toUpperCase()]) {
      label = FACULTY_LABEL_OVERRIDES[text.toUpperCase()];
    }

    const normalized = normalizeFacultyKey(label);
    if (!normalized) {
      continue;
    }

    faculties.push({
      key: normalized,
      label: formatDisplayLabel(normalized),
      path: buildFacultyPathFromName(normalized)
    });
  }

  return faculties;
}

function getXmlValues(node: Element, tagName: string): string[] {
  return Array.from(node.getElementsByTagName(tagName))
    .map((entry) => (entry.textContent || "").trim())
    .filter(Boolean);
}

function inferYearLabel(values: string[]): string {
  for (const value of values) {
    const match = value.match(/(19|20)\d{2}/);
    if (match) {
      return match[0];
    }
  }

  return "Academic Collection";
}

function extractYear(value: string): number | undefined {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLanguageCode(value: string): string {
  const v = String(value || "").trim().toLowerCase();
  if (!v) {
    return "Nespecificata";
  }

  if (["ro", "ron", "rum", "romanian", "romana", "romanae"].includes(v)) {
    return "Romana";
  }
  if (["en", "eng", "english"].includes(v)) {
    return "Engleza";
  }
  if (["fr", "fra", "fre", "french", "franceza"].includes(v)) {
    return "Franceza";
  }
  if (["de", "deu", "ger", "german", "germana"].includes(v)) {
    return "Germana";
  }
  if (["hu", "hun", "hungarian", "maghiara"].includes(v)) {
    return "Maghiara";
  }
  if (["la", "lat", "latin"].includes(v)) {
    return "Latina";
  }

  return v.charAt(0).toUpperCase() + v.slice(1);
}

function inferLanguageFromText(value: string): string {
  const raw = String(value || "");
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!text) {
    return "Nespecificata";
  }

  if (/\b(romana|romanian|limba\s+romana|in\s+romana)\b/.test(text)) {
    return "Romana";
  }
  if (/\b(english|engleza|in\s+engleza)\b/.test(text)) {
    return "Engleza";
  }
  if (/\b(franceza|french|in\s+franceza)\b/.test(text)) {
    return "Franceza";
  }
  if (/\b(germana|german|in\s+germana)\b/.test(text)) {
    return "Germana";
  }
  if (/\b(maghiara|hungarian|in\s+maghiara)\b/.test(text)) {
    return "Maghiara";
  }
  if (/\b(latina|latin|in\s+latina)\b/.test(text)) {
    return "Latina";
  }

  const taggedCode = text.match(/\b(?:lang(?:uage)?|limba)\s*[:=_-]?\s*(ro|en|fr|de|hu|la)\b/);
  if (taggedCode?.[1]) {
    return normalizeLanguageCode(taggedCode[1]);
  }

  // Accept compact code tokens only in file-like contexts (e.g. _en, -ro, (fr)).
  const fileLikeCode = raw.match(/(?:^|[_\-.()\[\]])(ro|en|fr|de|hu|la)(?:[_\-.()\[\]]|$)/i);
  if (fileLikeCode?.[1]) {
    return normalizeLanguageCode(fileLikeCode[1]);
  }

  return "Nespecificata";
}

function cleanDepartmentLabel(value: string): string {
  const normalized = decodeLabel(String(value || "")).replace(/[_-]+/g, " ").trim();
  if (!normalized) {
    return "General";
  }

  return normalized;
}

function stripFileExtension(name: string): string {
  return String(name || "").replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase();
}

function realCoverForEntry(entry: DirectoryEntry, entries: DirectoryEntry[]): string {
  const images = entries.filter((candidate) => {
    if (candidate.isFolder) {
      return false;
    }
    return /\.(jpg|jpeg|png|webp|avif)$/i.test(candidate.path);
  });

  if (images.length === 0) {
    return coverImageForPath(entry.path);
  }

  const byBase = new Map<string, string>();
  for (const image of images) {
    byBase.set(stripFileExtension(image.name), image.path);
  }

  const matching = byBase.get(stripFileExtension(entry.name));
  if (matching) {
    return matching;
  }

  const coverLike = images.find((image) => /cover|coperta|front|thumbnail|thumb/i.test(image.name));
  if (coverLike) {
    return coverLike.path;
  }

  return images[0]?.path || coverImageForPath(entry.path);
}

function parseOaiSets(xml: string): Map<string, string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const sets = Array.from(doc.getElementsByTagName("set"));
  const map = new Map<string, string>();

  for (const set of sets) {
    const spec = (set.getElementsByTagName("setSpec")[0]?.textContent || "").trim();
    const name = (set.getElementsByTagName("setName")[0]?.textContent || "").trim();
    if (spec && name) {
      map.set(spec, name);
    }
  }

  return map;
}

async function fetchOaiSets(): Promise<Map<string, string>> {
  try {
    const raw = localStorage.getItem(OAI_SETS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.savedAt && Date.now() - parsed.savedAt < SEARCH_CACHE_TTL && Array.isArray(parsed.entries)) {
        return new Map<string, string>(parsed.entries);
      }
    }
  } catch {
    // Cache miss — fetch fresh.
  }

  try {
    const targetUrl = `${DSPACE_OAI_BASE_URL}?verb=ListSets`;
    const response = await fetch(`/api/bcu/html?url=${encodeURIComponent(targetUrl)}`, {
      credentials: "include",
      cache: "force-cache"
    });

    if (!response.ok) {
      return new Map();
    }

    const xml = await response.text();
    const setsMap = parseOaiSets(xml);

    try {
      localStorage.setItem(OAI_SETS_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        entries: Array.from(setsMap.entries())
      }));
    } catch {
      // Cache is optional.
    }

    return setsMap;
  } catch {
    return new Map();
  }
}

function departmentFromSetSpecs(setSpecs: string[], setsMap: Map<string, string>): string {
  // Prefer collection-level sets (col_*) which correspond to departments.
  const colSpecs = setSpecs.filter((spec) => spec.startsWith("col_"));
  for (const spec of colSpecs) {
    const name = setsMap.get(spec);
    if (name) {
      return cleanDepartmentLabel(name);
    }
  }
  return "";
}

function parseOaiBooks(xml: string, facultyLabel: string, setsMap: Map<string, string> = new Map()): { books: Book[]; resumptionToken: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { books: [], resumptionToken: "" };
  }

  const rows = Array.from(doc.getElementsByTagName("record"));
  const books: Book[] = [];

  for (const row of rows) {
    const headerNode = row.getElementsByTagName("header")[0];
    const metadataNode = row.getElementsByTagName("metadata")[0];
    if (!metadataNode) {
      continue;
    }

    // Extract setSpecs from the record header to resolve the real department.
    const setSpecs = Array.from(headerNode?.getElementsByTagName("setSpec") ?? [])
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);

    const titles = getXmlValues(metadataNode, "dc:title");
    const identifiers = getXmlValues(metadataNode, "dc:identifier");
    const contributors = getXmlValues(metadataNode, "dc:contributor.author");
    const fallbackContributors = getXmlValues(metadataNode, "dc:contributor");
    const subjects = getXmlValues(metadataNode, "dc:subject");
    const descriptions = getXmlValues(metadataNode, "dc:description");
    const dates = getXmlValues(metadataNode, "dc:date");
    const languages = getXmlValues(metadataNode, "dc:language");
    const formats = getXmlValues(metadataNode, "dc:format").map((entry) => entry.toLowerCase());

    const hasPdf = formats.some((entry) => entry.includes("pdf"));
    if (!hasPdf) {
      continue;
    }

    const handleUrl = identifiers.find((entry) => /\/handle\//i.test(entry));
    if (!handleUrl) {
      continue;
    }

    const normalizedHandleUrl = handleUrl.replace(/^http:\/\/dspace\.bcucluj\.ro/i, "https://dspace.bcucluj.ro");
    const thumb = identifiers
      .find((entry) => /\/image\/thumbs\//i.test(entry))
      ?.replace(/^http:\/\/dspace\.bcucluj\.ro/i, "https://dspace.bcucluj.ro");
    const title = titles[0] || "Document BCU";
    const author = contributors[0] || fallbackContributors[0] || "BCU";
    const subject = subjects[0] || "BCU DSpace";
    const description = descriptions[0] || `Document BCU disponibil prin DSpace (${facultyLabel}).`;
    const year = extractYear(dates.join(" "));
    const languageFromMetadata = languages.find(Boolean);
    const language = languageFromMetadata
      ? normalizeLanguageCode(languageFromMetadata)
      : inferLanguageFromText([title, descriptions[0] || ""].join(" "));
    const languageSource = languageFromMetadata
      ? "metadata"
      : (language === "Nespecificata" ? "unknown" : "inferred");

    // OAI records from BCU DSpace often have noisy metadata.
    // We try to extract a specific department by scanning dc:subject, dc:description and dc:contributor
    // against our known UBB specialization map for this faculty.
    let resolvedDept = departmentFromSetSpecs(setSpecs, setsMap);

    if (!resolvedDept || resolvedDept === "General") {
      const metaStrings = [...subjects, ...descriptions, ...fallbackContributors];
      for (const str of metaStrings) {
        const found = resolveKnownDepartment(facultyLabel, str);
        if (found && found !== "General") {
          resolvedDept = found;
          break;
        }
      }
    }

    const department = resolvedDept || "General";

    books.push({
      id: encodeURIComponent(normalizedHandleUrl),
      title,
      author,
      description,
      coverImage: thumb || coverImageForPath(normalizedHandleUrl),
      genre: [subject],
      era: year ? String(year) : inferYearLabel(dates),
      faculty: facultyLabel,
      department,
      language,
      languageSource,
      publishedYear: year,
      folderPath: DSPACE_OAI_BASE_URL,
      filePath: normalizedHandleUrl,
      date: dates[0] || "-",
      sizeBytes: 0
    });
  }

  const token = (doc.getElementsByTagName("resumptionToken")[0]?.textContent || "").trim();
  return { books, resumptionToken: token };
}

async function loadCatalogFromOai(
  faculty: Faculty,
  options: { force?: boolean; onProgress?: (current: number, totalApprox: number) => void } = {}
): Promise<Book[]> {
  const { force = false, onProgress } = options;

  const cached = force ? null : loadOaiCache();
  if (cached && cached.length) {
    // Only return books that genuinely belong to this faculty in the OAI pool.
    // If the pool is generic/unfiltered, we only show books matching our label.
    return cached.filter((book) => book.faculty === faculty.label);
  }

  // Fetch the OAI sets map once — this gives us col_* → department name.
  const setsMap = await fetchOaiSets();

  let token = "";
  let page = 0;
  const merged = new Map<string, Book>();

  while (page < OAI_MAX_PAGES && merged.size < OAI_MAX_RECORDS) {
    const targetUrl = token
      ? `${DSPACE_OAI_BASE_URL}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`
      : `${DSPACE_OAI_BASE_URL}?verb=ListRecords&metadataPrefix=oai_dc`;

    const response = await fetch(`/api/bcu/html?url=${encodeURIComponent(targetUrl)}`, {
      credentials: "include",
      cache: "force-cache"
    });

    if (!response.ok) {
      throw new Error(`OAI HTTP ${response.status}`);
    }

    const xml = await response.text();
    if (!xml || xml.length < 300) {
      break;
    }

    const parsed = parseOaiBooks(xml, faculty.label, setsMap);
    for (const book of parsed.books) {
      if (!merged.has(book.filePath)) {
        merged.set(book.filePath, book);
      }
      if (merged.size >= OAI_MAX_RECORDS) {
        break;
      }
    }

    page += 1;
    if (onProgress) {
      onProgress(page, OAI_MAX_PAGES);
    }

    if (!parsed.resumptionToken) {
      break;
    }

    token = parsed.resumptionToken;
  }

  const result = Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title, "ro"));
  const normalized = normalizeBooksForUi(result);
  saveOaiCache(normalized);
  return normalized;
}

function getStaticFacultyFallback(): Faculty[] {
  return STATIC_FACULTY_NAMES.map((name) => {
    const normalized = normalizeFacultyKey(name);
    return {
      key: normalized,
      label: formatDisplayLabel(normalized),
      path: buildFacultyPathFromName(normalized)
    };
  });
}

export async function discoverFaculties(): Promise<Faculty[]> {
  const merged = new Map<string, Faculty>();

  const addMany = (items: Faculty[]) => {
    for (const item of items) {
      const label = normalizeFacultyKey(item.label || item.key || "");
      if (!label) {
        continue;
      }

      const canonical = canonicalFacultyId(label);
      if (!canonical) {
        continue;
      }

      const entry: Faculty = {
        key: normalizeFacultyKey(item.key || label),
        label: formatDisplayLabel(label),
        path: ensureTrailingSlash(item.path || buildFacultyPathFromName(label))
      };

      if (!merged.has(canonical)) {
        merged.set(canonical, entry);
        continue;
      }

      const existing = merged.get(canonical) as Faculty;
      if (item.path && item.path !== existing.path) {
        merged.set(canonical, { ...existing, path: ensureTrailingSlash(item.path) });
      }
    }
  };

  try {
    const listingHtml = await fetchDirectoryHtml(LIBRARY_BASE_URL);
    const listingEntries = parseDirectoryListing(listingHtml, LIBRARY_BASE_URL);
    const listingFaculties: Faculty[] = listingEntries
      .filter((entry) => entry.isFolder)
      .map((entry) => ({
        key: normalizeFacultyKey(entry.name),
        label: normalizeFacultyKey(entry.name),
        path: ensureTrailingSlash(entry.path)
      }));

    addMany(listingFaculties);
  } catch {
    // Keep fallback behavior.
  }

  try {
    const rootHtml = await fetchRawHtml(LIBRARY_BASE_URL);
    addMany(parseFacultyOptionsFromRootHtml(rootHtml));
  } catch {
    // Keep fallback behavior.
  }

  addMany(getStaticFacultyFallback());

  const list = Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label, "ro"));
  return list.length
    ? list
    : [{ key: "Litere", label: "Litere", path: buildFacultyPathFromName("Litere") }];
}

function coverImageForPath(path: string): string {
  void path;
  return "";
}

function titleFromName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "");
}

function prettifyNamePart(value: string): string {
  return decodeLabel(String(value || ""))
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStructuredFileName(fileName: string): {
  matched: boolean;
  author?: string;
  title?: string;
  publishedYear?: number;
} {
  const raw = titleFromName(fileName);
  const normalized = prettifyNamePart(raw);
  const match = normalized.match(/^([^-]+)-(.+)-((?:19|20)\d{2})$/);
  if (!match) {
    return { matched: false };
  }

  const author = prettifyNamePart(match[1]);
  const title = prettifyNamePart(match[2]);
  const publishedYear = Number.parseInt(match[3], 10);

  if (!author || !title || !Number.isFinite(publishedYear)) {
    return { matched: false };
  }

  return {
    matched: true,
    author,
    title,
    publishedYear
  };
}

function inferDepartmentFromFolderPath(folderPath: string): string {
  const clean = decodeLabel(String(folderPath || "")).replace(/\/+$/, "");
  if (!clean) {
    return "General";
  }

  const byUrlPath = clean.split("/").filter(Boolean);
  const lastSegment = byUrlPath[byUrlPath.length - 1] || "";
  if (!lastSegment || /^pdfview$/i.test(lastSegment)) {
    return "General";
  }

  return cleanDepartmentLabel(lastSegment) || "General";
}

function normalizeBookForUi(book: Book): Book {
  const fileName = decodeLabel((book.filePath || "").split("/").pop() || "");
  const parsed = parseStructuredFileName(fileName || book.title || "");

  const cleanAuthor = prettifyNamePart(book.author || "");
  const nextAuthor = parsed.author || cleanAuthor || "BCU";

  const cleanTitle = prettifyNamePart(book.title || "") || titleFromName(fileName) || "Document";
  const nextTitle = parsed.title || cleanTitle;

  const inferredYear = parsed.publishedYear
    || book.publishedYear
    || extractYear([book.era || "", book.date || "", book.title || "", fileName].join(" "));

  const currentDepartment = cleanDepartmentLabel(book.department || "");
  const fallbackDepartment = inferDepartmentFromFolderPath(book.folderPath || "");
  let nextDepartment = currentDepartment && currentDepartment !== "General"
    ? currentDepartment
    : fallbackDepartment;

  if (normForCompare(nextDepartment) === normForCompare(nextAuthor)) {
    nextDepartment = "General";
  }

  return {
    ...book,
    author: nextAuthor,
    title: nextTitle,
    publishedYear: inferredYear,
    era: inferredYear ? String(inferredYear) : (book.era || "Academic Collection"),
    department: nextDepartment || "General",
    coverImage: (book.coverImage || "").trim()
  };
}

function normalizeBooksForUi(books: Book[]): Book[] {
  return books.map((book) => normalizeBookForUi(book));
}

function relativePathSegments(rootPath: string, folderPath: string): string[] {
  const normalizedRoot = ensureTrailingSlash(rootPath);
  const normalizedFolder = ensureTrailingSlash(folderPath);
  if (!normalizedFolder.startsWith(normalizedRoot)) {
    return [];
  }

  const relative = normalizedFolder.replace(normalizedRoot, "").replace(/\/$/, "");
  if (!relative) {
    return [];
  }

  return relative.split("/").map((segment) => decodeLabel(segment)).filter(Boolean);
}

function cacheKey(facultyKey: string): string {
  return `${SEARCH_CACHE_PREFIX}${encodeURIComponent(facultyKey)}`;
}

function loadFromCache(faculty: Faculty): Book[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(faculty.key));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.rootUrl !== faculty.path || !parsed.savedAt || !Array.isArray(parsed.books)) {
      localStorage.removeItem(cacheKey(faculty.key));
      return null;
    }

    if (parsed.books.length === 0) {
      localStorage.removeItem(cacheKey(faculty.key));
      return null;
    }

    if (Date.now() - parsed.savedAt > SEARCH_CACHE_TTL) {
      localStorage.removeItem(cacheKey(faculty.key));
      return null;
    }

    return normalizeBooksForUi(parsed.books as Book[]);
  } catch {
    return null;
  }
}

function saveToCache(faculty: Faculty, books: Book[]): void {
  if (!books.length) {
    return;
  }

  try {
    const payload = {
      rootUrl: faculty.path,
      savedAt: Date.now(),
      books
    };
    localStorage.setItem(cacheKey(faculty.key), JSON.stringify(payload));
  } catch {
    // Cache is optional.
  }
}

function loadOaiCache(): Book[] | null {
  try {
    const raw = localStorage.getItem(OAI_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt || !Array.isArray(parsed.books) || parsed.books.length === 0) {
      localStorage.removeItem(OAI_CACHE_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > SEARCH_CACHE_TTL) {
      localStorage.removeItem(OAI_CACHE_KEY);
      return null;
    }

    return normalizeBooksForUi(parsed.books as Book[]);
  } catch {
    return null;
  }
}

function saveOaiCache(books: Book[]): void {
  if (!books.length) {
    return;
  }

  try {
    localStorage.setItem(OAI_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      books
    }));
  } catch {
    // Cache is optional.
  }
}

function clearOaiSetsCache(): void {
  try {
    localStorage.removeItem(OAI_SETS_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function loadCatalogForFaculty(faculty: Faculty, options: CatalogOptions = {}): Promise<Book[]> {
  const { force = false, onProgress } = options;

  if (!force) {
    // --- NEW: SERVER-SIDE INDEXING PREFERENCE ---
  try {
    const serverUrl = `/api/bcu/catalog/${encodeURIComponent(faculty.key)}`;
    const sRes = await fetch(serverUrl);
    if (sRes.ok) {
      const data = await sRes.json();
      console.log(`[BCU] Loaded ${data.books.length} books from server for ${faculty.label}`);
      return normalizeBooksForUi(data.books || []);
    }
    
    // If not found, try to trigger a server rebuild
    if (sRes.status === 404) {
      console.log(`[BCU] Server index missing for ${faculty.label}. Triggering rebuild...`);
      const rRes = await fetch(`${serverUrl}/rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: faculty.label, url: faculty.path })
      });
      if (rRes.ok) {
        const rData = await rRes.json();
        // Now fetch it again or use returned data
        const nextRes = await fetch(serverUrl);
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          return normalizeBooksForUi(nextData.books || []);
        }
      }
    }
  } catch (err) {
    console.error("[BCU] Server indexing failed, falling back to local scan:", err);
  }

  // --- EXISTING LOCAL FALLBACK LOGIC ---
  const cached = loadFromCache(faculty);
  if (cached) {
    return cached;
  }
  } else {
    // Invalidate the OAI sets cache so department hierarchy is re-fetched on rebuild.
    clearOaiSetsCache();
  }

  const queue: string[] = [ensureTrailingSlash(faculty.path)];
  const seen = new Set<string>();
  const books: Book[] = [];
  let scannedFolders = 0;

  while (queue.length) {
    const batch: string[] = [];

    while (queue.length && batch.length < INDEX_CONCURRENCY) {
      const folder = queue.shift() as string;
      if (seen.has(folder)) {
        continue;
      }
      seen.add(folder);
      batch.push(folder);
    }

    await Promise.all(batch.map(async (folderPath) => {
      try {
        // Stagger requests within the batch to reduce burst load on BCU.
        await new Promise((r) => setTimeout(r, Math.random() * 200));

        const html = await fetchDirectoryHtml(folderPath);
        const entries = parseDirectoryListing(html, folderPath);

        for (const entry of entries) {
          if (entry.isFolder) {
            queue.push(ensureTrailingSlash(entry.path));
            continue;
          }

          if (!/\.pdf$/i.test(entry.path)) {
            continue;
          }

          const segments = relativePathSegments(faculty.path, folderPath);
          const parsedName = parseStructuredFileName(entry.name);
          const author = parsedName.author || "Autor necunoscut";
          const rawDept = cleanDepartmentLabel(segments[0] || "");
          // resolveKnownDepartment returns:
          //   canonical name  — folder matched a UBB specialization
          //   "General"       — faculty is in our map but folder didn't match (archival noise / ZZ_*)
          //   null            — faculty not in our static map → use raw folder name as-is
          const resolved = resolveKnownDepartment(faculty.label, rawDept);
          const department = resolved !== null ? resolved : (rawDept || "General");
          const year = parsedName.publishedYear || extractYear([entry.date, ...segments, entry.name].join(" "));
          const era = year ? String(year) : (segments[1] || "Academic Collection");
          const language = inferLanguageFromText(entry.name);
          const languageSource = language === "Nespecificata" ? "unknown" : "filename";
          const title = parsedName.title || prettifyNamePart(titleFromName(entry.name));
          const location = segments.join(" / ") || "radacina";
          const description = `Document din colectia ${faculty.label}. Departament: ${department}. Locatie: ${location}.`;

          books.push({
            id: encodeURIComponent(entry.path),
            title,
            author,
            description,
            coverImage: realCoverForEntry(entry, entries),
            genre: [faculty.label],
            era,
            faculty: faculty.label,
            department,
            language,
            languageSource,
            publishedYear: year,
            folderPath,
            filePath: entry.path,
            date: entry.date,
            sizeBytes: entry.sizeBytes
          });
        }
      } catch {
        // Ignore folder fetch errors and continue indexing.
      } finally {
        scannedFolders += 1;
        if (onProgress) {
          onProgress(scannedFolders, scannedFolders + queue.length);
        }
      }
    }));

    // Throttle between batches to avoid 429 rate limiting from BCU server.
    if (queue.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  if (books.length === 0) {
    try {
      const fallbackBooks = await loadCatalogFromOai(faculty, { force, onProgress });
      if (fallbackBooks.length > 0) {
        saveToCache(faculty, fallbackBooks);
        return normalizeBooksForUi(fallbackBooks);
      }
    } catch {
      // Keep empty result if OAI fallback is unavailable.
    }
  }

  books.sort((a, b) => a.title.localeCompare(b.title, "ro"));
  const normalized = normalizeBooksForUi(books);
  saveToCache(faculty, normalized);
  return normalized;
}

export async function searchBooksServer(query: string): Promise<Book[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const normalizeServerResult = (input: Record<string, unknown>): Book => {
    const filePath = String(input.filePath || input.file_path || input.id || "").trim();
    const fileName = decodeLabel(filePath.split("/").pop() || "");
    const parsed = parseStructuredFileName(fileName || String(input.title || ""));

    const title = parsed.title
      || prettifyNamePart(String(input.title || ""))
      || prettifyNamePart(titleFromName(fileName))
      || "Document";

    const author = parsed.author
      || prettifyNamePart(String(input.author || ""))
      || "Autor necunoscut";

    const publishedYear = parsed.publishedYear
      || Number(input.publishedYear || input.published_year || 0)
      || extractYear([String(input.date || ""), String(input.era || ""), fileName].join(" "));

    const faculty = prettifyNamePart(String(input.faculty || "")) || "BCU";
    const department = cleanDepartmentLabel(String(input.department || "General"));
    const language = normalizeLanguageCode(String(input.language || ""));
    const rawGenre = input.genre;
    const genre = Array.isArray(rawGenre)
      ? rawGenre.map((entry) => String(entry || "")).filter(Boolean)
      : [];
    const coverImage = String(input.coverImage || input.cover_image || "").trim();
    const folderPath = String(input.folderPath || input.folder_path || "").trim();
    const languageSourceRaw = String(input.languageSource || "").toLowerCase();
    const languageSource = languageSourceRaw === "metadata"
      || languageSourceRaw === "filename"
      || languageSourceRaw === "inferred"
      || languageSourceRaw === "unknown"
      ? languageSourceRaw
      : (language === "Nespecificata" ? "unknown" : "inferred");

    return {
      id: String(input.id || encodeURIComponent(filePath || title)),
      title,
      author,
      description: String(input.description || `Document indexat pentru ${faculty}.`),
      coverImage,
      genre: genre.length > 0 ? genre : [faculty],
      era: publishedYear ? String(publishedYear) : String(input.era || "Academic Collection"),
      faculty,
      department,
      language,
      languageSource,
      publishedYear,
      folderPath,
      filePath: filePath || String(input.id || ""),
      date: String(input.date || "-"),
      sizeBytes: Number.isFinite(Number(input.sizeBytes)) ? Number(input.sizeBytes) : 0
    };
  };
  
  try {
    const res = await fetch(`/api/bcu/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.books)
        ? data.books.map((book: Partial<Book>) => normalizeServerResult(book))
        : [];
    }
  } catch (err) {
    console.error("[BCU] Server search failed:", err);
  }
  return [];
}

export async function triggerGlobalRebuild(): Promise<void> {
  try {
    await fetch("/api/bcu/catalog/rebuild-all", { method: "POST" });
  } catch (err) {
    console.error("[BCU] Global rebuild trigger failed:", err);
  }
}

export function searchBooks(books: Book[], query: string): Book[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return books;
  }

  return books.filter((book) => {
    const yearText = book.publishedYear ? String(book.publishedYear) : "";
    const genreText = Array.isArray(book.genre) ? book.genre.join(" ") : "";
    return (
      book.title.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q) ||
      genreText.toLowerCase().includes(q) ||
      book.era.toLowerCase().includes(q) ||
      (book.language || "").toLowerCase().includes(q) ||
      (book.department || "").toLowerCase().includes(q) ||
      yearText.includes(q) ||
      (book.folderPath || "").toLowerCase().includes(q)
    );
  });
}
