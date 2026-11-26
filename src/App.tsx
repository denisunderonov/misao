import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { assetUrl, content, homeworkPath, topicPath } from "./lib/content";
import type { Subject, Topic } from "./types";

const { site, subjects, topics, assignments = [] } = content;
type Theme = "dark" | "light";

function initialTheme(): Theme {
  const initialized = document.documentElement.dataset.theme;
  if (initialized === "light" || initialized === "dark") return initialized;
  try {
    const saved = localStorage.getItem("misao-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // The site remains usable when the browser blocks storage.
  }
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const label =
    theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#01001c" : "#fafaff");
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("misao-theme", nextTheme);
    } catch {
      // Changing the theme does not depend on persistent storage.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </>
        ) : (
          <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z" />
        )}
      </svg>
    </button>
  );
}

function SiteHeader() {
  const { pathname } = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedControl = useRef<HTMLElement | null>(null);
  const focusAfterResize = useRef<{
    target: "menu-button" | "navigation";
    previous: HTMLElement;
  } | null>(null);

  function closeMenu(restoreFocus = false) {
    if (
      restoreFocus &&
      isMobile &&
      menuRef.current?.contains(document.activeElement)
    ) {
      menuButtonRef.current?.focus();
    }
    setMenuOpen(false);
  }

  useEffect(() => {
    let wasMobile = window.innerWidth <= 760;

    function trackFocus(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        menuRef.current?.contains(target) ||
        target === menuButtonRef.current
      ) {
        lastFocusedControl.current = target;
      } else if (
        target !== document.body &&
        target !== document.documentElement
      ) {
        lastFocusedControl.current = null;
      }
    }

    function trackPointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        !menuButtonRef.current?.contains(event.target)
      ) {
        lastFocusedControl.current = null;
      }
    }

    function handleResize() {
      const mobile = window.innerWidth <= 760;
      const previous = lastFocusedControl.current;
      const active = document.activeElement;
      const focusWasReset =
        active === document.body ||
        active === document.documentElement ||
        active === previous;

      // CSS can blur a hidden control before the resize event reaches React.
      if (mobile !== wasMobile && previous && focusWasReset) {
        if (mobile && menuRef.current?.contains(previous)) {
          focusAfterResize.current = { target: "menu-button", previous };
        } else if (!mobile && previous === menuButtonRef.current) {
          focusAfterResize.current = { target: "navigation", previous };
        }
      }
      wasMobile = mobile;
      setIsMobile(mobile);
      if (!mobile) setMenuOpen(false);
    }

    document.addEventListener("focusin", trackFocus);
    document.addEventListener("pointerdown", trackPointer);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("focusin", trackFocus);
      document.removeEventListener("pointerdown", trackPointer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const pending = focusAfterResize.current;
    focusAfterResize.current = null;
    if (!pending) return;
    const active = document.activeElement;
    if (
      active !== document.body &&
      active !== document.documentElement &&
      active !== pending.previous
    )
      return;
    if (isMobile && pending.target === "menu-button") {
      menuButtonRef.current?.focus();
    } else if (!isMobile && pending.target === "navigation") {
      menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    }
  }, [isMobile]);

  useEffect(() => {
    if (!menuOpen || !isMobile) return;
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
    function handleOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        !menuButtonRef.current?.contains(event.target)
      ) {
        closeMenu(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [menuOpen, isMobile]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          to="/"
          className="brand brand-logo"
          aria-label={`${site.shortTitle} — главная`}
          onClick={() => setMenuOpen(false)}
        >
          <img src={assetUrl("/owl-logo.svg")} alt="" width="72" height="72" />
        </Link>
        <button
          type="button"
          className="menu-toggle"
          ref={menuButtonRef}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => (menuOpen ? closeMenu(true) : setMenuOpen(true))}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            {menuOpen ? (
              <path d="m6 6 12 12M6 18 18 6" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <nav
          id="primary-navigation"
          className={`header-nav${menuOpen ? " is-open" : ""}`}
          aria-label="Основная навигация"
          hidden={isMobile && !menuOpen}
          ref={menuRef}
        >
          <NavLink
            to="/"
            end
            className="header-nav-link"
            onClick={() => closeMenu(true)}
          >
            Дисциплины
          </NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>
          Дизайн и разработка сайта:{" "}
          <a className="footer-link" href={site.githubUrl}>
            Github
          </a>
        </p>
        <p className="copyright">© 2026</p>
      </div>
    </footer>
  );
}

function NewBadge() {
  return <span className="new-badge" aria-label="Новый материал"><span aria-hidden="true">new</span></span>;
}

function UpdateBadge() {
  return <span className="new-badge update-badge" aria-label="Обновлённый материал"><span aria-hidden="true">update</span></span>;
}

function HomePage() {
  return (
    <div className="container library-page">
      <h1 className="page-title" id="disciplines">
        Дисциплины
      </h1>
      <div className="course-list">
        {subjects.map((subject) => (
          <Link
            key={subject.id}
            to={`/subjects/${encodeURIComponent(subject.id)}`}
            className={`course-card accent-${subject.color}`}
          >
            {subject.isUpdated ? <UpdateBadge /> : subject.isNew && <NewBadge />}
            <h2>{subject.title}</h2>
            <span className="course-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        ))}
      </div>
      {!subjects.length && (
        <div className="empty-state">
          <p>Дисциплины пока не добавлены</p>
        </div>
      )}
    </div>
  );
}

function sortedMaterials(subject: Subject, materials: Topic[]) {
  const sectionOrder = new Map(
    subject.sections.map((section) => [section.id, section.order]),
  );
  return materials
    .filter((material) => material.subject === subject.id)
    .sort(
      (a, b) =>
        (sectionOrder.get(a.section) ?? 0) -
          (sectionOrder.get(b.section) ?? 0) ||
        a.order - b.order ||
        a.title.localeCompare(b.title, "ru"),
    );
}

function MaterialList({
  materials,
  kind,
}: {
  materials: Topic[];
  kind: "knowledge" | "homework";
}) {
  if (!materials.length)
    return <p className="section-empty">Материалы скоро появятся</p>;

  return (
    <div className="material-list">
      {materials.map((material) => (
        <Link
          key={material.slug}
          className={`material-card ${kind === "knowledge" ? "knowledge-card" : "assignment-card"}`}
          to={
            kind === "knowledge"
              ? topicPath(material.subject, material.slug)
              : homeworkPath(material.subject, material.slug)
          }
        >
          {material.isUpdated ? <UpdateBadge /> : material.isNew && <NewBadge />}
          <h3>{material.title}</h3>
          <span className="row-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
      ))}
    </div>
  );
}

function SubjectPage() {
  const { subjectId } = useParams();
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return <NotFoundPage />;

  return (
    <div className="container library-page">
      <Link to="/" className="back-link">
        ← Все дисциплины
      </Link>
      <h1 className="page-title subject-title">{subject.title}</h1>
      <div className="course-sections">
        <section className="course-section" aria-labelledby="knowledge-heading">
          <h2 className="section-title" id="knowledge-heading">
            База знаний
          </h2>
          <MaterialList
            materials={sortedMaterials(subject, topics)}
            kind="knowledge"
          />
        </section>
        <section
          className="course-section"
          aria-labelledby="assignments-heading"
        >
          <h2 className="section-title" id="assignments-heading">
            Домашние задания
          </h2>
          <MaterialList
            materials={sortedMaterials(subject, assignments)}
            kind="homework"
          />
        </section>
      </div>
    </div>
  );
}

function MarkdownBody({ body }: { body: string }) {
  const hint = /^### (Подсказка [0-9]+)\s*$/m.exec(body);
  if (hint && hint.index !== undefined) {
    const start = hint.index + hint[0].length;
    const tail = body.slice(start);
    const next = /^#{1,3} /m.exec(tail);
    const end = next?.index ?? tail.length;
    return <>
      {hint.index > 0 && <MarkdownBody body={body.slice(0, hint.index)} />}
      <details className="prose hint"><summary>{hint[1]}</summary>
        <MarkdownBody body={tail.slice(0, end).trim()} />
      </details>
      {next && <MarkdownBody body={tail.slice(end)} />}
    </>;
  }
  const marker = "\n## Ответы для самопроверки\n";
  const position = body.indexOf(marker);
  if (position !== -1) {
    return (<>
      <MarkdownBody body={body.slice(0, position)} />
      <details className="prose"><summary>Ответы для самопроверки</summary>
        <MarkdownBody body={body.slice(position + marker.length)} />
      </details>
    </>);
  }
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: "warn" }]]}
        components={{
          p: ({ children }) => {
            const notice = typeof children === "string" && /^Отправлять преподавателю не нужно[.!]?$/.test(children.trim());
            return notice ? <p className="submission-notice"><strong>{children}</strong></p> : <p>{children}</p>;
          },
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              {...(href?.startsWith("https://") || href?.startsWith("http://")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              {...props}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...props }) => (
            <img
              src={src?.startsWith("/") ? assetUrl(src) : src}
              alt={alt ?? ""}
              loading="lazy"
              {...props}
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

function TopicPage() {
  const { subjectId, slug } = useParams();
  const subject = subjects.find((item) => item.id === subjectId);
  const topic = topics.find(
    (item) => item.subject === subjectId && item.slug === slug,
  );
  if (!subject || !topic) return <NotFoundPage />;

  return (
    <div className="container library-page reading-page">
      <Link
        to={`/subjects/${encodeURIComponent(subject.id)}`}
        className="back-link"
      >
        ← {subject.title}
      </Link>
      <article className="topic-article">
        <h1 className="page-title topic-title">{topic.title}</h1>
        {topic.subject === "programming-algorithms" && topic.slug === "git-github-basics" && (
          <div className="lesson-video">
            <iframe src="https://www.youtube-nocookie.com/embed/8u6xaEYGLa0" title="Видео о Git и GitHub" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            <p><a href="https://www.youtube.com/watch?v=8u6xaEYGLa0" target="_blank" rel="noreferrer">Открыть видео на YouTube</a></p>
          </div>
        )}
        <MarkdownBody body={topic.body} />
      </article>
    </div>
  );
}

function HomeworkPage() {
  const { subjectId, slug } = useParams();
  const subject = subjects.find((item) => item.id === subjectId);
  const assignment = assignments.find(
    (item) => item.subject === subjectId && item.slug === slug,
  );
  if (!subject || !assignment) return <NotFoundPage />;

  return (
    <div className="container library-page reading-page homework-page">
      <Link
        to={`/subjects/${encodeURIComponent(subject.id)}`}
        className="back-link"
      >
        ← {subject.title}
      </Link>
      <article className={`topic-article ${["python-homework-1-factorial", "python-homework-1-median"].includes(assignment.slug) ? "python-homework" : ""}`}>
        <h1 className="page-title topic-title">{assignment.title}</h1>
        <MarkdownBody body={assignment.body} />
      </article>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="container library-page not-found">
      <h1 className="page-title">Такой страницы нет</h1>
      <p>Возможно, адрес изменился или материал ещё не опубликован.</p>
      <Link to="/" className="back-link">
        ← Все дисциплины
      </Link>
    </div>
  );
}

function RouteEffects() {
  const { pathname } = useLocation();
  const initial = useRef(true);

  useEffect(() => {
    const pieces = pathname.split("/");
    const subject = subjects.find((item) => item.id === pieces[2]);
    const collection = pieces[3] === "homework" ? assignments : topics;
    const material = collection.find(
      (item) => item.subject === pieces[2] && item.slug === pieces[4],
    );
    document.title = `${material?.title ?? subject?.title ?? (pathname === "/" ? "Учебные материалы" : "Страница не найдена")} — ${site.shortTitle}`;
    if (!initial.current) {
      window.scrollTo({ top: 0 });
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }
    initial.current = false;
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      <RouteEffects />
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/subjects/:subjectId" element={<SubjectPage />} />
          <Route
            path="/subjects/:subjectId/topics/:slug"
            element={<TopicPage />}
          />
          <Route
            path="/subjects/:subjectId/homework/:slug"
            element={<HomeworkPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </>
  );
}
