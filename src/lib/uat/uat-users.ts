import type { UserRoleName } from '@/types/database';

export interface LegitimateUATUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleName;
  department: string;
}

export const LEGITIMATE_UAT_USERS: LegitimateUATUser[] = [
  {
    id: 'USR002',
    name: 'Borra Narsimulu',
    email: 'icontechpro@gmail.com',
    role: 'Managing Director',
    department: 'Executive Governance & Leadership',
  },
  {
    id: 'USR001',
    name: 'B V Dheeraj Reddy',
    email: 'dheeraj@icontechpro.in',
    role: 'Admin / BDM',
    department: 'Administration, IT & Business Development',
  },
  {
    id: 'USR003',
    name: 'B V Vineet Babu',
    email: 'vineet@icontechpro.in',
    role: 'Sales Executive',
    department: 'Corporate Sales & Solutions',
  },
  {
    id: 'USR004',
    name: 'Reshma',
    email: 'sales@icontechpro.in',
    role: 'Sales Executive',
    department: 'Field Sales & Customer Communication',
  },
  {
    id: 'USR005',
    name: 'Hemalath',
    email: 'accounts@icontechpro.in',
    role: 'Accounts',
    department: 'Finance, Invoicing & Accounts',
  },
  {
    id: 'USR006',
    name: 'Manisha',
    email: 'service01@icontechpro.in',
    role: 'Office Assistant',
    department: 'Operations & Service Coordination',
  },
];
