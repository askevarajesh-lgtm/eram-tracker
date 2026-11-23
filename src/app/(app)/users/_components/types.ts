/** One entry in the Users & access register (a record, not an app account). */
export type AccessRow = {
  id: string;
  name: string;
  email: string;
  sapCode: string;
  companyId: string;
  companyName: string;
  branch: string;
  dept: string;
  designation: string;
  status: string;
  userType: string;
  apps: { projectId: string; role: string }[];
  licenceIds: string[];
};

export type ProjectCard = { id: string; name: string; color: string; count: number };
