import bcrypt from 'bcrypt';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { teamRepository } from './team.repository';
import { TeamMember, TeamMemberActivity, MemberStats } from './team.types';
import { AddMemberSchema, UpdateRoleSchema } from './dto/member.dto';

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

  private assertAdmin(role: string): void {
    if (role !== 'admin') throw new AppError(403, 'Only an admin can manage the team');
  }
}

export const teamService = new TeamService();
