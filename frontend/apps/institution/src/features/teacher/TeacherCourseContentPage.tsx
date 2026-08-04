import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip } from '@stemora/ui';
import {
  EmptyState,
  ErrorBanner,
  Pill,
  StatusPill,
  TEACHER_API,
  TeacherShell,
  arabicTitle,
  formatDate,
  formatDateTime,
  useTeacherContext,
} from './shared';

type CourseLesson = {
  id: number;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  sequence: number;
  estimated_minutes: number | null;
  difficulty: string | null;
  status: string;
};

type CourseChapter = {
  id: number;
  title_en: string;
  title_ar: string | null;
  sequence: number;
  status: string;
  subject: string | null;
  subject_id: number | null;
  grade: string | null;
  lessons_count: number;
  lessons: CourseLesson[];
};

type InteractiveLesson = {
  id: number;
  title_en: string;
  title_ar: string | null;
  status: string;
  completion_rule: string | null;
  blocks_count: number;
  published_at: string | null;
};

type ContentStats = { chapters: number; lessons: number; interactive: number; published: number };

type ContentTab = 'curriculum' | 'interactive';

const emptyStats: ContentStats = { chapters: 0, lessons: 0, interactive: 0, published: 0 };

export function TeacherCourseContentPage() {
  const { api } = useAuth();
  const { context } = useTeacherContext();

  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [interactive, setInteractive] = useState<InteractiveLesson[]>([]);
  const [stats, setStats] = useState<ContentStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<ContentTab>('curriculum');
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set<number>());
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedInteractiveId, setSelectedInteractiveId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (subjectFilter) params.set('subject_id', subjectFilter);
      const query = params.toString();
      const res = await api.get<{
        data: { chapters: CourseChapter[]; interactive_lessons: InteractiveLesson[] };
        meta: { stats: ContentStats };
      }>(`${TEACHER_API}/course-content${query ? `?${query}` : ''}`);
      setChapters(res.data?.chapters ?? []);
      setInteractive(res.data?.interactive_lessons ?? []);
      setStats(res.meta?.stats ?? emptyStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your course content.');
    } finally {
      setLoading(false);
    }
  }, [api, subjectFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const term = search.trim().toLowerCase();

  const visibleChapters = useMemo(() => {
    if (!term) return chapters;
    const matches: CourseChapter[] = [];
    for (const chapter of chapters) {
      const chapterMatch =
        chapter.title_en.toLowerCase().includes(term) || (chapter.subject ?? '').toLowerCase().includes(term);
      if (chapterMatch) {
        matches.push(chapter);
        continue;
      }
      const lessons = chapter.lessons.filter(
        (lesson) =>
          lesson.title_en.toLowerCase().includes(term) ||
          (lesson.code ?? '').toLowerCase().includes(term) ||
          (lesson.summary_en ?? '').toLowerCase().includes(term)
      );
      if (lessons.length) matches.push({ ...chapter, lessons });
    }
    return matches;
  }, [chapters, term]);

  const visibleInteractive = useMemo(() => {
    if (!term) return interactive;
    return interactive.filter((lesson) => lesson.title_en.toLowerCase().includes(term));
  }, [interactive, term]);

  const selected = useMemo(() => {
    if (selectedLessonId === null) return null;
    for (const chapter of chapters) {
      const lesson = chapter.lessons.find((item) => item.id === selectedLessonId);
      if (lesson) return { chapter, lesson };
    }
    return null;
  }, [chapters, selectedLessonId]);

  const selectedInteractive = useMemo(
    () => interactive.find((lesson) => lesson.id === selectedInteractiveId) ?? null,
    [interactive, selectedInteractiveId]
  );

  // While a search term is active every matching chapter stays open, otherwise the
  // matched lessons would be hidden behind a collapsed row.
  const isExpanded = (chapterId: number) => Boolean(term) || expanded.has(chapterId);

  function toggleChapter(chapterId: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(visibleChapters.map((chapter) => chapter.id)));
  }

  function collapseAll() {
    setExpanded(new Set<number>());
  }

  const lessonCount = visibleChapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);

  return (
    <TeacherShell
      title="Course Content"
      subtitle="Browse your curriculum chapters and interactive lessons"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Curriculum</p>
            <h2 className="tp-hero-title">Course content</h2>
            <p className="tp-hero-lead">
              Explore the chapters mapped to the subjects you teach, open a chapter to read its lesson sequence, and
              review the interactive lessons that are ready to assign to your classes.
            </p>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Chapters', value: String(stats.chapters) },
            { label: 'Lessons', value: String(stats.lessons), hint: 'Across every chapter' },
            { label: 'Interactive', value: String(stats.interactive), hint: 'Block-based lessons' },
            { label: 'Published', value: String(stats.published), hint: 'Ready for learners' },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by chapter, lesson, or code"
              aria-label="Search course content"
            />
          </label>
          <label className="tk-field">
            <span>Subject</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="">All subjects</option>
              {context?.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name_en}
                </option>
              ))}
            </select>
          </label>
          <div className="tk-toolbar-actions">
            <div className="tk-tabs" role="tablist" aria-label="Content view">
              <button
                type="button"
                role="tab"
                id="tk-tab-curriculum"
                aria-controls="tk-panel-curriculum"
                aria-selected={tab === 'curriculum'}
                className={tab === 'curriculum' ? 'is-active' : undefined}
                onClick={() => setTab('curriculum')}
              >
                Curriculum
                <span className="tk-tab-count">{visibleChapters.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tk-tab-interactive"
                aria-controls="tk-panel-interactive"
                aria-selected={tab === 'interactive'}
                className={tab === 'interactive' ? 'is-active' : undefined}
                onClick={() => setTab('interactive')}
              >
                Interactive lessons
                <span className="tk-tab-count">{visibleInteractive.length}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="tp-layout">
          {tab === 'curriculum' ? (
            <Panel
              title="Curriculum"
              description={
                loading
                  ? 'Loading…'
                  : `${visibleChapters.length} chapter${visibleChapters.length === 1 ? '' : 's'} · ${lessonCount} lesson${
                      lessonCount === 1 ? '' : 's'
                    } — open a chapter to select a lesson.`
              }
              action={
                <div className="tk-row">
                  <Button size="sm" type="button" variant="secondary" onClick={expandAll}>
                    Expand all
                  </Button>
                  <Button size="sm" type="button" variant="secondary" onClick={collapseAll}>
                    Collapse all
                  </Button>
                </div>
              }
            >
              <div id="tk-panel-curriculum" role="tabpanel" aria-labelledby="tk-tab-curriculum">
                {visibleChapters.length === 0 && !loading ? (
                  <EmptyState
                    title="No chapters found"
                    message="No curriculum chapters match the current subject and search. Clear the filters to see everything mapped to your classes."
                  />
                ) : (
                  <div className="tk-tree">
                    {visibleChapters.map((chapter) => {
                      const open = isExpanded(chapter.id);
                      return (
                        <div className="tk-tree-group" key={chapter.id}>
                          <button
                            type="button"
                            className="tk-tree-head"
                            aria-expanded={open}
                            onClick={() => toggleChapter(chapter.id)}
                          >
                            <span className="tk-caret" aria-hidden="true">
                              ▶
                            </span>
                            <span className="tk-lesson-seq">{chapter.sequence}</span>
                            <span className="tk-tree-title">
                              <strong>{chapter.title_en}</strong>
                              <span>
                                {[chapter.subject, chapter.grade].filter(Boolean).join(' · ') || 'Unmapped'} ·{' '}
                                {chapter.lessons_count} lesson{chapter.lessons_count === 1 ? '' : 's'}
                              </span>
                            </span>
                            <StatusPill status={chapter.status} />
                          </button>
                          {open ? (
                            <div className="tk-tree-body">
                              {chapter.lessons.length === 0 ? (
                                <p className="tp-muted" style={{ padding: '0.5rem 0.75rem' }}>
                                  This chapter has no lessons yet.
                                </p>
                              ) : (
                                chapter.lessons.map((lesson) => (
                                  <button
                                    type="button"
                                    key={lesson.id}
                                    className={`tk-lesson-row${selectedLessonId === lesson.id ? ' is-selected' : ''}`}
                                    onClick={() => setSelectedLessonId(lesson.id)}
                                  >
                                    <span className="tk-lesson-seq">{lesson.sequence}</span>
                                    <span className="tk-lesson-main">
                                      <strong>{lesson.title_en}</strong>
                                      <span>
                                        {lesson.code ? `${lesson.code} · ` : ''}
                                        {lesson.estimated_minutes ? `${lesson.estimated_minutes} min` : 'Duration not set'}
                                      </span>
                                    </span>
                                    <StatusPill status={lesson.status} />
                                  </button>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel
              title="Interactive lessons"
              description={
                loading
                  ? 'Loading…'
                  : `${visibleInteractive.length} interactive lesson${
                      visibleInteractive.length === 1 ? '' : 's'
                    } built from content blocks.`
              }
            >
              <div id="tk-panel-interactive" role="tabpanel" aria-labelledby="tk-tab-interactive">
                {visibleInteractive.length === 0 && !loading ? (
                  <EmptyState
                    title="No interactive lessons"
                    message="Interactive lessons appear here once they are built for the subjects you teach."
                  />
                ) : (
                  <div className="tk-grid">
                    {visibleInteractive.map((lesson) => (
                      <button
                        type="button"
                        key={lesson.id}
                        className={`tk-card${selectedInteractiveId === lesson.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedInteractiveId(lesson.id)}
                      >
                        <div className="tk-card-head">
                          <h3 className="tk-card-title">{lesson.title_en}</h3>
                          <StatusPill status={lesson.status} />
                        </div>
                        {arabicTitle(lesson.title_ar, lesson.title_en) ? (
                          <p className="tk-card-sub">{arabicTitle(lesson.title_ar, lesson.title_en)}</p>
                        ) : null}
                        <div className="tk-card-foot">
                          <span>
                            <strong>{lesson.blocks_count}</strong> block{lesson.blocks_count === 1 ? '' : 's'}
                          </span>
                          <span>Published {formatDate(lesson.published_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          <aside>
            {tab === 'curriculum' ? (
              selected ? (
                <Panel title="Lesson detail" description={selected.lesson.title_en}>
                  <div className="tk-detail-scroll tk-stack">
                    <dl className="tp-meta">
                      <div>
                        <dt>Chapter</dt>
                        <dd>{selected.chapter.title_en}</dd>
                      </div>
                      <div>
                        <dt>Code</dt>
                        <dd>{selected.lesson.code ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Sequence</dt>
                        <dd>{selected.lesson.sequence}</dd>
                      </div>
                      <div>
                        <dt>Estimated</dt>
                        <dd>
                          {selected.lesson.estimated_minutes ? `${selected.lesson.estimated_minutes} min` : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Difficulty</dt>
                        <dd>
                          {selected.lesson.difficulty ? (
                            <Pill label={selected.lesson.difficulty} tone="info" />
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>
                          <StatusPill status={selected.lesson.status} />
                        </dd>
                      </div>
                    </dl>

                    {arabicTitle(selected.lesson.title_ar, selected.lesson.title_en) ? (
                      <div className="tk-note-block">
                        <h4>Arabic title</h4>
                        <p className="tk-note">{arabicTitle(selected.lesson.title_ar, selected.lesson.title_en)}</p>
                      </div>
                    ) : null}

                    <div className="tk-note-block">
                      <h4>Summary</h4>
                      <p className="tk-note">
                        {selected.lesson.summary_en ?? 'No summary has been written for this lesson yet.'}
                      </p>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel title="Lesson detail">
                  <EmptyState
                    title="Nothing selected"
                    message="Open a chapter and choose a lesson to read its summary, duration, and difficulty."
                  />
                </Panel>
              )
            ) : selectedInteractive ? (
              <Panel title="Interactive detail" description={selectedInteractive.title_en}>
                <div className="tk-detail-scroll tk-stack">
                  <dl className="tp-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selectedInteractive.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Blocks</dt>
                      <dd>{selectedInteractive.blocks_count}</dd>
                    </div>
                    <div>
                      <dt>Completion</dt>
                      <dd>
                        {selectedInteractive.completion_rule ? (
                          <Pill label={selectedInteractive.completion_rule} tone="info" />
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Published</dt>
                      <dd>{formatDateTime(selectedInteractive.published_at)}</dd>
                    </div>
                  </dl>

                  {arabicTitle(selectedInteractive.title_ar, selectedInteractive.title_en) ? (
                    <div className="tk-note-block">
                      <h4>Arabic title</h4>
                      <p className="tk-note">
                        {arabicTitle(selectedInteractive.title_ar, selectedInteractive.title_en)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : (
              <Panel title="Interactive detail">
                <EmptyState
                  title="Nothing selected"
                  message="Choose an interactive lesson to see how many blocks it contains and when it was published."
                />
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </TeacherShell>
  );
}
