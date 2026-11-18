export interface SiteSettings {
  title: string;
  shortTitle: string;
  description: string;
  academicYear: string;
  footer: string;
  adminUrl: string;
  githubUrl: string;
  demo: boolean;
}

export interface Section {
  id: string;
  title: string;
  order: number;
}

export interface Subject {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  sections: Section[];
}

export interface Topic {
  subject: string;
  section: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  updatedAt: string;
  published?: boolean;
  body: string;
}

export interface Assignment extends Topic {
  pdf: string;
}

export interface CourseContent {
  site: SiteSettings;
  subjects: Subject[];
  topics: Topic[];
  assignments: Assignment[];
}
