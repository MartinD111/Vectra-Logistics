import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { projectsRepository } from './projects.repository';
import { Project, Program, ProjectWithCounts, ProjectStats } from './projects.types';
import { CreateProjectSchema, UpdateProjectSchema } from './dto/project.dto';
import { CreateProgramSchema, UpdateProgramSchema } from './dto/program.dto';

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

  // ── Internal ──────────────────────────────────────────────────────────────────

  private async assertOwnedProject(id: string, companyId: string): Promise<Project> {
    const p = await projectsRepository.findProject(id);
    if (!p) throw new AppError(404, 'Project not found');
    if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
    return p;
  }

  private async assertOwnedProgram(id: string, companyId: string): Promise<Program> {
    const p = await projectsRepository.findProgram(id);
    if (!p) throw new AppError(404, 'Program not found');
    if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
    return p;
  }
}

export const projectsService = new ProjectsService();
