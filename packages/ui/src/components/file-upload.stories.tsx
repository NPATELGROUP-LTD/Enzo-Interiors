import type { Meta, StoryObj } from '@storybook/react-vite';

import { FileUpload } from './file-upload';

const meta: Meta<typeof FileUpload> = {
  title: 'Components/FileUpload',
  component: FileUpload,
};
export default meta;

type Story = StoryObj<typeof FileUpload>;

export const Empty: Story = {
  args: { onFilesSelected: () => {} },
};

export const WithFiles: Story = {
  args: {
    onFilesSelected: () => {},
    onRemove: () => {},
    files: [
      { name: 'floor-plan.pdf', sizeBytes: 245_000, status: 'success' },
      { name: 'mood-board.jpg', sizeBytes: 1_200_000, status: 'uploading', progress: 55 },
      { name: 'contract.pdf', sizeBytes: 88_000, status: 'error', error: 'File too large' },
    ],
  },
};
