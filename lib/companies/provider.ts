/** A registered Dutch business, as the registry search returns it. */
export type CompanyHit = {
  /** Chamber of Commerce (KvK) number, 8 digits. */
  kvk: string;
  name: string;
  city: string | null;
  /** Head office, branch, … as the registry words it. */
  type: string | null;
};

export type CompanyProvider = {
  search(query: string, signal: AbortSignal): Promise<CompanyHit[]>;
};

/** Whether a registry is configured. Without a key the company field is simply a text box. */
export const companyLookupEnabled = () => Boolean(process.env.KVK_API_KEY);
