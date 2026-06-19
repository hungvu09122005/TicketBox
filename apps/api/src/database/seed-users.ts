import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { User as UserEntity } from '../modules/users/entities/user.entity';
import { Role } from '../common/constants/roles.enum';

type SeedUserConfig = {
  role: Role;
  email: string;
  name: string;
  password: string;
};

export async function seedUsers(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(UserEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);

  const seedConfigs: SeedUserConfig[] = [
    {
      role: Role.ORGANIZER,
      email: process.env.SEED_ORGANIZER_EMAIL ?? 'organizer@ticketbox.local',
      name: process.env.SEED_ORGANIZER_NAME ?? 'Organizer User',
      password: process.env.SEED_ORGANIZER_PASSWORD ?? 'Organizer@123456',
    },
    {
      role: Role.CHECKIN_STAFF,
      email: process.env.SEED_STAFF_EMAIL ?? 'staff@ticketbox.local',
      name: process.env.SEED_STAFF_NAME ?? 'Check-in Staff',
      password: process.env.SEED_STAFF_PASSWORD ?? 'Staff@123456',
    },
    {
      role: Role.AUDIENCE,
      email: process.env.SEED_AUDIENCE_EMAIL ?? 'audience@ticketbox.local',
      name: process.env.SEED_AUDIENCE_NAME ?? 'Audience User',
      password: process.env.SEED_AUDIENCE_PASSWORD ?? 'Audience@123456',
    },
  ];

  for (const config of seedConfigs) {
    const role = await roleRepo.findOne({ where: { name: config.role } });
    if (!role) {
      throw new Error(`${config.role} role not found. Run RBAC seed first.`);
    }

    const passwordHash = await bcrypt.hash(config.password, 12);
    const existingUser = await userRepo.findOne({
      where: { email: config.email },
      relations: { roles: true },
    });

    if (existingUser) {
      existingUser.name = config.name;
      existingUser.passwordHash = passwordHash;
      existingUser.isActive = true;
      existingUser.roles = [role];
      await userRepo.save(existingUser);
      console.log(`✅ ${config.role} user updated: ${config.email}`);
      continue;
    }

    const user = userRepo.create({
      email: config.email,
      name: config.name,
      passwordHash,
      roles: [role],
    });

    await userRepo.save(user);
    console.log(`✅ ${config.role} user seeded: ${config.email}`);
  }
}
