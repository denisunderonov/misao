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
  isNew?: boolean;
  isUpdated?: boolean;
  id: string;
  title: string;
  icon: string;
  color: string;
  sections: Section[];
}

export interface Topic {
  subject: string;
  section: string;
  slug: string;
  title: string;
  isNew?: boolean;
  isUpdated?: boolean;
  order: number;
  updatedAt: string;
  published?: boolean;
  body: string;
}

export type Assignment = Topic;

export interface CourseContent {
  site: SiteSettings;
  subjects: Subject[];
  topics: Topic[];
  assignments: Assignment[];
}
