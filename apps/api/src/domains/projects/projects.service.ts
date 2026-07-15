import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { foldersRepository } from '../folders/folders.repository';
import { projectsRepository } from './projects.repository';
import { calendarRepository } from '../outlook/calendar.repository';
import { Project, Program, ProjectWithCounts, ProjectStats, ProjectPage, ActivityEventRow } from './projects.types';
import { CalendarEvent } from '../outlook/outlook.types';
import { CreateProjectSchema, UpdateProjectSchema } from './dto/project.dto';
import { CreateProgramSchema, UpdateProgramSchema } from './dto/program.dto';
import { CreatePageSchema, UpdatePageSchema } from './dto/page.dto';

class ProjectsService {
  // ── Projects ────────────────────────────────────────────────────────────────

  listProjects(companyId: string): Promise<ProjectWithCounts[]> {
    return projectsRepository.listProjects(companyId);
  }

  async getProject(id: string, companyId: string): Promise<Project> {
    return this.assertOwnedProject(id, companyId);
  }

  async createProject(companyId: string, actorId: string | null, body: unknown): Promise<Project> {
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.folder_id) await this.assertOwnedFolder(parsed.data.folder_id, companyId);
    const project = await projectsRepository.createProject(companyId, actorId, parsed.data);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'project.created',
      objectType: 'project', objectId: project.id, projectId: project.id,
      payload: { name: project.name },
    });
    return project;
  }

  async updateProject(id: string, companyId: string, body: unknown): Promise<Project> {
    await this.assertOwnedProject(id, companyId);
    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.folder_id) await this.assertOwnedFolder(parsed.data.folder_id, companyId);
    const updated = await projectsRepository.updateProject(id, parsed.data);
    if (!updated) throw new AppError(404, 'Project not found');
    return updated;
  }

  async deleteProject(id: string, companyId: string): Promise<void> {
    await this.assertOwnedProject(id, companyId);
    await projectsRepository.deleteProject(id); // programs.project_id ON DELETE SET NULL
  }

  getProjectStats(id: string, companyId: string): Promise<ProjectStats> {
    return this.assertOwnedProject(id, companyId).then(() =>
      projectsRepository.projectStats(companyId, id),
    );
  }

  // ── Programs ────────────────────────────────────────────────────────────────

  listPrograms(companyId: string, projectId?: string): Promise<Program[]> {
    return projectsRepository.listPrograms(companyId, projectId);
  }

  async getProgram(id: string, companyId: string): Promise<Program> {
    return this.assertOwnedProgram(id, companyId);
  }

  async createProgram(companyId: string, actorId: string | null, body: unknown): Promise<Program> {
    const parsed = CreateProgramSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    // If assigning to a project, verify it belongs to this company.
    if (parsed.data.project_id) await this.assertOwnedProject(parsed.data.project_id, companyId);
    if (parsed.data.folder_id) await this.assertOwnedFolder(parsed.data.folder_id, companyId);

    const program = await projectsRepository.createProgram(companyId, actorId, parsed.data);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'program.created',
      objectType: 'program', objectId: program.id, projectId: program.project_id,
      payload: { name: program.name, type: program.type },
    });
    return program;
  }

  async updateProgram(id: string, companyId: string, actorId: string | null, body: unknown): Promise<Program> {
    await this.assertOwnedProgram(id, companyId);
    const parsed = UpdateProgramSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.project_id) await this.assertOwnedProject(parsed.data.project_id, companyId);
    if (parsed.data.folder_id) await this.assertOwnedFolder(parsed.data.folder_id, companyId);

    const updated = await projectsRepository.updateProgram(id, parsed.data);
    if (!updated) throw new AppError(404, 'Program not found');
    if (parsed.data.status === 'published') {
      await recordEvent({
        tenantId: companyId, actorId, verb: 'program.published',
        objectType: 'program', objectId: id, projectId: updated.project_id,
        payload: { name: updated.name },
      });
    }
    return updated;
  }

  async deleteProgram(id: string, companyId: string): Promise<void> {
    await this.assertOwnedProgram(id, companyId);
    await projectsRepository.deleteProgram(id);
  }

  // ── Project pages ─────────────────────────────────────────────────────────────

  async listPages(projectId: string, companyId: string): Promise<ProjectPage[]> {
    await this.assertOwnedProject(projectId, companyId);
    return projectsRepository.listPages(companyId, projectId);
  }

  /** All pages across every project in the company — used to build the navbar's project/page hover menu. */
  listAllPages(companyId: string): Promise<ProjectPage[]> {
    return projectsRepository.listAllPages(companyId);
  }

  async getPage(id: string, companyId: string): Promise<ProjectPage> {
    return this.assertOwnedPage(id, companyId);
  }

  async createPage(projectId: string, companyId: string, actorId: string | null, body: unknown): Promise<ProjectPage> {
    await this.assertOwnedProject(projectId, companyId);
    const parsed = CreatePageSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const page = await projectsRepository.createPage(companyId, projectId, actorId, parsed.data);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'page.created',
      objectType: 'page', objectId: page.id, projectId,
      payload: { title: page.title },
    });
    return page;
  }

  async updatePage(id: string, companyId: string, actorId: string | null, body: unknown): Promise<ProjectPage> {
    const existing = await this.assertOwnedPage(id, companyId);
    const parsed = UpdatePageSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const updated = await projectsRepository.updatePage(id, existing.project_id, parsed.data);
    if (!updated) throw new AppError(404, 'Page not found');
    await recordEvent({
      tenantId: companyId, actorId, verb: 'page.updated',
      objectType: 'page', objectId: id, projectId: existing.project_id,
      payload: { title: updated.title },
    });
    return updated;
  }

  async deletePage(id: string, companyId: string, actorId: string | null): Promise<void> {
    const existing = await this.assertOwnedPage(id, companyId);
    await projectsRepository.deletePage(id);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'page.deleted',
      objectType: 'page', objectId: id, projectId: existing.project_id,
      payload: { title: existing.title },
    });
  }

  // ── Project activity feed ──────────────────────────────────────────────────────

  async listActivity(
    projectId: string, companyId: string, opts: { limit?: number; before?: string | null },
  ): Promise<ActivityEventRow[]> {
    await this.assertOwnedProject(projectId, companyId);
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    return projectsRepository.listActivity(companyId, projectId, { limit, before: opts.before ?? null });
  }

  // ── Calendar (synced from Outlook, categorized by project) ────────────────────

  async listCalendarEvents(
    projectId: string, companyId: string, opts: { start: string; end: string },
  ): Promise<CalendarEvent[]> {
    await this.assertOwnedProject(projectId, companyId);
    return calendarRepository.listForProject(companyId, projectId, opts.start, opts.end);
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  private async assertOwnedProject(id: string, companyId: string): Promise<Project> {
    const p = await projectsRepository.findProjectForCompany(id, companyId);
    if (!p) throw new AppError(404, 'Project not found');
    return p;
  }

  private async assertOwnedPage(id: string, companyId: string): Promise<ProjectPage> {
    const p = await projectsRepository.findPageForCompany(id, companyId);
    if (!p) throw new AppError(404, 'Page not found');
    return p;
  }

  private async assertOwnedProgram(id: string, companyId: string): Promise<Program> {
    const p = await projectsRepository.findProgramForCompany(id, companyId);
    if (!p) throw new AppError(404, 'Program not found');
    return p;
  }

  private async assertOwnedFolder(id: string, companyId: string): Promise<void> {
    const f = await foldersRepository.findFolder(id);
    if (!f) throw new AppError(404, 'Folder not found');
    if (f.company_id !== companyId) throw new AppError(403, 'Forbidden');
  }
}

export const projectsService = new ProjectsService();
