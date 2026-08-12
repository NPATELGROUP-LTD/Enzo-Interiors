import type { Meta, StoryObj } from '@storybook/react-vite';

import { Gallery } from './gallery';

const meta: Meta<typeof Gallery> = {
  title: 'Components/Gallery',
  component: Gallery,
};
export default meta;

type Story = StoryObj<typeof Gallery>;

const images = [
  { id: '1', src: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', alt: 'Modern kitchen with island', caption: 'Smith Residence — Kitchen' },
  { id: '2', src: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400', alt: 'Bedroom fitted wardrobes', caption: 'Chen Family — Bedroom' },
  { id: '3', src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400', alt: 'Living room media wall', caption: 'Okafor Household — Media Wall' },
];

export const PortfolioGrid: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <Gallery images={images} columns={2} />
    </div>
  ),
};
