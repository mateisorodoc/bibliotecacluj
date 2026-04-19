import type { Book, Faculty } from "../types";

const LIBRARY_BASE_URL = "https://public-view.bcucluj.ro/pdfview/";
const DSPACE_OAI_BASE_URL = "https://dspace.bcucluj.ro/oai/request";

const SEARCH_CACHE_PREFIX = "bcu_react_index_v5_";
const OAI_CACHE_KEY = "bcu_react_oai_fallback_v5";
const SEARCH_CACHE_TTL = 1000 * 60 * 60 * 12;
const INDEX_CONCURRENCY = 4;
const OAI_MAX_PAGES = 40;
const OAI_MAX_RECORDS = 4000;

const FACULTY_LABEL_OVERRIDES: Record<string, string> = {
  BIOL: "Biologie si Geologie",
  BUSIN: "Business",
  CHIM: "Chimie si Inginerie Chimica",
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
  "Biologie si Geologie",
  "Business",
  "Chimie si Inginerie Chimica",
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

  const response = await fetch(`/api/bcu/html?url=${encodeURIComponent(url)}`, {
    credentials: "include",
    cache: "force-cache"
  });
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

function parseOaiBooks(xml: string, facultyLabel: string): { books: Book[]; resumptionToken: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { books: [], resumptionToken: "" };
  }

  const rows = Array.from(doc.getElementsByTagName("record"));
  const books: Book[] = [];

  for (const row of rows) {
    const metadataNode = row.getElementsByTagName("metadata")[0];
    if (!metadataNode) {
      continue;
    }

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

    books.push({
      id: encodeURIComponent(normalizedHandleUrl),
      title,
      author,
      description,
      coverImage: thumb || coverImageForPath(normalizedHandleUrl),
      genre: [subject],
      era: year ? String(year) : inferYearLabel(dates),
      faculty: facultyLabel,
      department: cleanDepartmentLabel(subject),
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
    return cached.map((book) => ({ ...book, faculty: faculty.label }));
  }

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

    const parsed = parseOaiBooks(xml, faculty.label);
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
  saveOaiCache(result);
  return result;
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
  return `https://picsum.photos/seed/${encodeURIComponent(path)}/480/720`;
}

function titleFromName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "");
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

    return parsed.books as Book[];
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

    return parsed.books as Book[];
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

export async function loadCatalogForFaculty(faculty: Faculty, options: CatalogOptions = {}): Promise<Book[]> {
  const { force = false, onProgress } = options;

  if (!force) {
    const cached = loadFromCache(faculty);
    if (cached) {
      return cached;
    }
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
          const author = segments[0] || faculty.label;
          const department = cleanDepartmentLabel(segments[0] || "General");
          const year = extractYear([entry.date, ...segments, entry.name].join(" "));
          const era = year ? String(year) : (segments[1] || "Academic Collection");
          const language = inferLanguageFromText(entry.name);
          const languageSource = language === "Nespecificata" ? "unknown" : "filename";
          const title = titleFromName(entry.name);
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
  }

  if (books.length === 0) {
    try {
      const fallbackBooks = await loadCatalogFromOai(faculty, { force, onProgress });
      if (fallbackBooks.length > 0) {
        saveToCache(faculty, fallbackBooks);
        return fallbackBooks;
      }
    } catch {
      // Keep empty result if OAI fallback is unavailable.
    }
  }

  books.sort((a, b) => a.title.localeCompare(b.title, "ro"));
  saveToCache(faculty, books);
  return books;
}

export function getBookById(books: Book[], bookId: string): Book | null {
  return books.find((book) => book.id === bookId) || null;
}

export function searchBooks(books: Book[], query: string): Book[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return books;
  }

  return books.filter((book) => {
    const yearText = book.publishedYear ? String(book.publishedYear) : "";
    return (
      book.title.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q) ||
      book.genre.join(" ").toLowerCase().includes(q) ||
      book.era.toLowerCase().includes(q) ||
      (book.language || "").toLowerCase().includes(q) ||
      (book.department || "").toLowerCase().includes(q) ||
      yearText.includes(q) ||
      (book.folderPath || "").toLowerCase().includes(q)
    );
  });
}
