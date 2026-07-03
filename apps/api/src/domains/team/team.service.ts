import bcrypt from 'bcrypt';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { teamRepository } from './team.repository';
import { TeamMember, TeamMemberActivity, MemberStats, ProjectAssignment } from './team.types';
import { AddMemberSchema, UpdateRoleSchema, UpdateCustomRoleTitleSchema } from './dto/member.dto';
import { AssignProjectSchema, UpdateAssignmentSchema } from './dto/assignment.dto';

class TeamService {
  listMembers(companyId: string): Promise<TeamMemberActivity[]> {
    return teamRepository.listMembersWithActivity(companyId);
  }

  async getMemberStats(id: string, companyId: string): Promise<MemberStats> {
    const member = await teamRepository.findMember(id, companyId);
    if (!member) throw new AppError(404, 'Member not found');
    return teamRepository.memberStats(companyId, id);
  }

  async addMember(
    companyId: string, requestingRole: string, actorId: string | null, body: unknown,
  ): Promise<TeamMember> {
    this.assertAdmin(requestingRole);
    const parsed = AddMemberSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    if (await teamRepository.emailExists(parsed.data.email)) {
      throw new AppError(409, 'A user with that email already exists');
    }

    const password_hash = await bcrypt.hash(parsed.data.password, 10);
    const member = await teamRepository.createMember(companyId, {
      email: parsed.data.email,
      password_hash,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      role: parsed.data.role,
      custom_role_title: parsed.data.custom_role_title ?? null,
      phone: parsed.data.phone ?? null,
    });

    await recordEvent({
      tenantId: companyId, actorId, verb: 'team.member.added',
      objectType: 'user', objectId: member.id,
      payload: { email: member.email, role: member.role },
    });
    return member;
  }

  async updateRole(
    id: string, companyId: string, requestingRole: string, actorId: string | null, body: unknown,
  ): Promise<TeamMember> {
    this.assertAdmin(requestingRole);
    const parsed = UpdateRoleSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const member = await teamRepository.findMember(id, companyId);
    if (!member) throw new AppError(404, 'Member not found');

    const updated = await teamRepository.updateRole(id, companyId, parsed.data.role);
    if (!updated) throw new AppError(404, 'Member not found');
    await recordEvent({
      tenantId: companyId, actorId, verb: 'team.member.role_changed',
      objectType: 'user', objectId: id,
      payload: { role: parsed.data.role },
    });
    return updated;
  }

  async removeMember(id: string, companyId: string, requestingRole: string, actorId: string | null): Promise<void> {
    this.assertAdmin(requestingRole);
    if (id === actorId) throw new AppError(400, 'You cannot remove yourself');
    const member = await teamRepository.findMember(id, companyId);
    if (!member) throw new AppError(404, 'Member not found');
    await teamRepository.deleteMember(id, companyId);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'team.member.removed',
      objectType: 'user', objectId: id, payload: { email: member.email },
    });
  }

  async updateCustomRoleTitle(
    id: string, companyId: string, requestingRole: string, actorId: string | null, body: unknown,
  ): Promise<TeamMember> {
    this.assertAdmin(requestingRole);
    const parsed = UpdateCustomRoleTitleSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const member = await teamRepository.findMember(id, companyId);
    if (!member) throw new AppError(404, 'Member not found');

    const updated = await teamRepository.updateCustomRoleTitle(id, companyId, parsed.data.custom_role_title);
    if (!updated) throw new AppError(404, 'Member not found');
    await recordEvent({
      tenantId: companyId, actorId, verb: 'team.member.custom_role_updated',
      objectType: 'user', objectId: id,
      payload: { custom_role_title: parsed.data.custom_role_title },
    });
    return updated;
  }

  // ── Project assignments ────────────────────────────────────────────────────

  async listAssignments(id: string, companyId: string): Promise<ProjectAssignment[]> {
    const member = await teamRepository.findMember(id, companyId);
    if (!member) throw new AppError(404, 'Member not found');
    return teamRepository.listAssignments(id, companyId);
  }

  async assignProject(
    id: string, companyId: string, requestingRole: string, actorId: string | null, body: unknown,
  ): Promise<ProjectAssignment> {
    this.assertAdmin(requestingRole);
    const parsed = AssignProjectSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const member = await teamRepository.findMember(id, companyId);
    if (!member) throw new AppError(404, 'Member not found');
    await this.assertOwnedProject(parsed.data.project_id, companyId);

    const assignment = await teamRepository.upsertAssignment(
      companyId, parsed.data.project_id, id, parsed.data.planned_pct,
    );
    await recordEvent({
      tenantId: companyId, actorId, verb: 'team.member.assigned_project',
      objectType: 'project_assignment', objectId: assignment.id, projectId: parsed.data.project_id,
      payload: { user_id: id, planned_pct: parsed.data.planned_pct },
    });
    return assignment;
  }

  async updateAssignment(
    id: string, assignmentId: string, companyId: string, requestingRole: string, actorId: string | null, body: unknown,
  ): Promise<ProjectAssignment> {
    this.assertAdmin(requestingRole);
    const parsed = UpdateAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const assignment = await teamRepository.findAssignment(assignmentId, companyId);
    if (!assignment || assignment.user_id !== id) throw new AppError(404, 'Assignment not found');

    const updated = await teamRepository.updateAssignmentPct(assignmentId, companyId, parsed.data.planned_pct);
    if (!updated) throw new AppError(404, 'Assignment not found');
    return updated;
  }

  async removeAssignment(
    id: string, assignmentId: string, companyId: string, requestingRole: string,
  ): Promise<void> {
    this.assertAdmin(requestingRole);
    const assignment = await teamRepository.findAssignment(assignmentId, companyId);
    if (!assignment || assignment.user_id !== id) throw new AppError(404, 'Assignment not found');
    await teamRepository.deleteAssignment(assignmentId, companyId);
  }

  private async assertOwnedProject(projectId: string, companyId: string): Promise<void> {
    const projectCompanyId = await teamRepository.findProjectCompany(projectId);
    if (!projectCompanyId) throw new AppError(404, 'Project not found');
    if (projectCompanyId !== companyId) throw new AppError(403, 'Forbidden');
  }

  private assertAdmin(role: string): void {
    if (role !== 'admin') throw new AppError(403, 'Only an admin can manage the team');
  }
}

export const teamService = new TeamService();
