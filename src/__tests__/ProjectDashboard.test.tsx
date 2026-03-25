import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectDashboard } from '@/components/features/projects/project-dashboard';
import { Project } from '@/types/domain';

const projects: Project[] = [
  { id: 'p1', code: 'PRJ1', name: 'Project One', ownerName: 'Alice', status: 'active', unreadCount: 2, summary: 's1', todoList: ['t1'], lastUpdateAt: 'now' },
  { id: 'p2', code: 'PRJ2', name: 'Project Two', ownerName: 'Bob', status: 'urgent', unreadCount: 1, summary: 's2', todoList: [], lastUpdateAt: 'yesterday' },
];

describe('ProjectDashboard', () => {
  it('renders summary cards and project items', () => {
    render(<ProjectDashboard projects={projects} />);

    expect(screen.getByText(/Tong project/i)).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
  });
});
