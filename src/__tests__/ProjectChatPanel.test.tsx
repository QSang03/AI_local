import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectChatPanel } from '@/components/features/chat/project-chat-panel';
import { Project, ProjectChatThread } from '@/types/domain';

const projects: Project[] = [
  {
    id: 'p1',
    code: 'PRJ1',
    name: 'Project One',
    ownerName: 'Alice',
    status: 'active',
    lastUpdateAt: 'now',
    unreadCount: 0,
    summary: 'summary',
    todoList: [],
  },
];

const threads: ProjectChatThread[] = [];

describe('ProjectChatPanel', () => {
  it('renders placeholder when no messages', () => {
    render(<ProjectChatPanel projects={projects} initialThreads={threads} />);
    expect(screen.getByText(/Chua co tin nhan/i)).toBeInTheDocument();
  });
});
