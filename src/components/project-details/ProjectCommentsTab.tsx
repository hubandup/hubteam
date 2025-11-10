import { ProjectTaskComments } from './ProjectTaskComments';

interface ProjectCommentsTabProps {
  projectId: string;
}

export function ProjectCommentsTab({ projectId }: ProjectCommentsTabProps) {
  return <ProjectTaskComments projectId={projectId} />;
}
