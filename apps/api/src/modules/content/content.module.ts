import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import {
  ContactSubmission,
  PortfolioItem,
  SERVICE_TYPES,
  SUBMISSION_STATUSES,
  ServiceType,
  SubmissionStatus,
  Testimonial,
} from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/* -------------------------------------------------------------------------- */
/* Service catalogue                                                          */
/* -------------------------------------------------------------------------- */

/**
 * GET /content/services.
 *
 * The four service categories with their Investment Guide tiers. This is
 * static marketing copy, not a database table — the Backend Schema has no
 * `services` table, and inventing one would put copywriting into a CRM screen
 * nobody asked for. The "from" figures line up with the calculator rates in
 * quotes.service.ts; if those change, change these too.
 */
const SERVICE_CATALOGUE: Array<{
  id: ServiceType;
  slug: string;
  name: string;
  summary: string;
  tiers: Array<{ name: string; from: number; description: string }>;
}> = [
  {
    id: 'Kitchen',
    slug: 'kitchens',
    name: 'Kitchens',
    summary:
      'Bespoke fitted kitchens designed around how you actually cook, built and installed by our own team.',
    tiers: [
      { name: 'Essential', from: 16100, description: 'Painted shaker fronts, laminate or timber worktops, quality soft-close hardware.' },
      { name: 'Premium', from: 24500, description: 'Quartz or granite surfaces, integrated appliances, feature lighting throughout.' },
      { name: 'Luxury', from: 36400, description: 'Dekton or book-matched stone, full appliance package, bespoke island and pantry joinery.' },
    ],
  },
  {
    id: 'Bedroom',
    slug: 'bedrooms',
    name: 'Bedrooms',
    summary: 'Fitted bedroom furniture that uses every awkward inch, from eaves storage to floating bedsides.',
    tiers: [
      { name: 'Essential', from: 8640, description: 'Fitted wardrobes and drawer units in a painted or matt finish.' },
      { name: 'Premium', from: 12960, description: 'Full-wall joinery with integrated lighting and a dressing area.' },
      { name: 'Luxury', from: 19200, description: 'Veneered or hand-painted suite with bespoke internals and concealed detailing.' },
    ],
  },
  {
    id: 'MediaWall',
    slug: 'media-walls',
    name: 'Media Walls',
    summary: 'Media walls that hide every cable and make the television part of the room rather than the point of it.',
    tiers: [
      { name: 'Essential', from: 5100, description: 'Painted media unit with concealed cable management and floating shelves.' },
      { name: 'Premium', from: 7500, description: 'Fluted or veneered feature wall with integrated LED and a recessed screen.' },
      { name: 'Luxury', from: 11100, description: 'Full-height book-matched joinery with electric fire and hidden storage.' },
    ],
  },
  {
    id: 'Wardrobe',
    slug: 'wardrobes',
    name: 'Wardrobes',
    summary: 'Walk-in and fitted wardrobes with internals planned around what you own, not a standard carcass.',
    tiers: [
      { name: 'Essential', from: 5120, description: 'Fitted sliding or hinged wardrobes with adjustable internals.' },
      { name: 'Premium', from: 7600, description: 'Walk-in conversion with soft-close rails, drawer banks and integrated lighting.' },
      { name: 'Luxury', from: 11200, description: 'Bespoke dressing room with island, mirrored detailing and glazed display.' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class CreateTestimonialDto {
  @IsString() @MinLength(2) @MaxLength(120) client_name!: string;
  @Type(() => Number) @IsInt() @Min(1, { message: 'Rating runs from 1 to 5' }) @Max(5) rating!: number;
  @IsString() @MinLength(10, { message: 'A review needs at least a sentence' }) review_text!: string;
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional() @IsBoolean() is_published?: boolean;
}

export class UpdateTestimonialDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) client_name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsString() @MinLength(10) review_text?: string;
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional() @IsBoolean() is_published?: boolean;
}

export class CreatePortfolioItemDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsIn(SERVICE_TYPES) category!: ServiceType;
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional() @IsString() @MaxLength(120) location?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1990) @Max(2100) year?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(260) duration_weeks?: number | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() materials_used?: string | null;

  @IsArray()
  @IsString({ each: true, message: 'Each image must be a URL string' })
  image_urls!: string[];

  @IsOptional() @IsBoolean() is_published?: boolean;
}

export class UpdatePortfolioItemDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string;
  @IsOptional() @IsIn(SERVICE_TYPES) category?: ServiceType;
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional() @IsString() @MaxLength(120) location?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1990) @Max(2100) year?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(260) duration_weeks?: number | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() materials_used?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) image_urls?: string[];
  @IsOptional() @IsBoolean() is_published?: boolean;
}

export class UpdateSubmissionDto {
  @IsIn(SUBMISSION_STATUSES, { message: `Status must be one of: ${SUBMISSION_STATUSES.join(', ')}` })
  status!: SubmissionStatus;
}

export class CreateSubmissionDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MaxLength(160) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(60) service_interest?: string | null;
  @IsString() @MinLength(5, { message: 'Tell us a little about your project' }) message!: string;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

@Injectable()
export class ContentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
  ) {}

  services() {
    return SERVICE_CATALOGUE;
  }

  /** Published portfolio only — this feeds the public gallery. */
  async publishedPortfolio(category?: string): Promise<PortfolioItem[]> {
    const items = await this.db.portfolioItems.findAll((item) => item.is_published);
    const filtered = category
      ? items.filter((item) => item.category.toLowerCase() === category.toLowerCase())
      : items;
    return filtered.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  }

  /** Published testimonials only. */
  async publishedTestimonials(): Promise<Testimonial[]> {
    const rows = await this.db.testimonials.findAll((row) => row.is_published);
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  /* ---- Testimonials (admin) ---- */

  async allTestimonials(): Promise<Testimonial[]> {
    const rows = await this.db.testimonials.findAll();
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createTestimonial(principal: AuthPrincipal, dto: CreateTestimonialDto): Promise<Testimonial> {
    const created = await this.db.testimonials.create({
      client_name: dto.client_name.trim(),
      rating: dto.rating,
      review_text: dto.review_text.trim(),
      project_id: dto.project_id ?? null,
      is_published: dto.is_published ?? false,
      created_at: new Date().toISOString(),
    });
    await this.activity.record({
      principal,
      action: 'testimonial_create',
      targetTable: 'testimonials',
      targetId: created.id,
      details: { client_name: created.client_name, rating: created.rating },
    });
    return created;
  }

  async updateTestimonial(
    principal: AuthPrincipal,
    id: string,
    dto: UpdateTestimonialDto,
  ): Promise<Testimonial> {
    const existing = await this.db.testimonials.findById(id);
    if (!existing) throw new NotFoundException('Testimonial not found');

    const updated = await this.db.testimonials.update(id, dto as Partial<Testimonial>);
    if (!updated) throw new NotFoundException('Testimonial not found');

    const publishToggled =
      dto.is_published !== undefined && dto.is_published !== existing.is_published;
    await this.activity.record({
      principal,
      action: publishToggled
        ? dto.is_published
          ? 'testimonial_publish'
          : 'testimonial_unpublish'
        : 'testimonial_update',
      targetTable: 'testimonials',
      targetId: id,
      details: { client_name: updated.client_name },
    });
    return updated;
  }

  async removeTestimonial(principal: AuthPrincipal, id: string) {
    const existing = await this.db.testimonials.findById(id);
    if (!existing) throw new NotFoundException('Testimonial not found');
    await this.db.testimonials.delete(id);
    await this.activity.record({
      principal,
      action: 'testimonial_delete',
      targetTable: 'testimonials',
      targetId: id,
      details: { client_name: existing.client_name },
    });
    return { id, deleted: true as const };
  }

  /* ---- Portfolio (admin) ---- */

  async allPortfolioItems(): Promise<PortfolioItem[]> {
    const rows = await this.db.portfolioItems.findAll();
    return rows.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  }

  async createPortfolioItem(
    principal: AuthPrincipal,
    dto: CreatePortfolioItemDto,
  ): Promise<PortfolioItem> {
    const created = await this.db.portfolioItems.create({
      project_id: dto.project_id ?? null,
      title: dto.title.trim(),
      category: dto.category,
      location: dto.location ?? null,
      year: dto.year ?? null,
      duration_weeks: dto.duration_weeks ?? null,
      description: dto.description ?? null,
      materials_used: dto.materials_used ?? null,
      image_urls: dto.image_urls,
      is_published: dto.is_published ?? true,
    });
    await this.activity.record({
      principal,
      action: 'portfolio_item_create',
      targetTable: 'portfolio_items',
      targetId: created.id,
      details: { title: created.title, category: created.category },
    });
    return created;
  }

  async updatePortfolioItem(
    principal: AuthPrincipal,
    id: string,
    dto: UpdatePortfolioItemDto,
  ): Promise<PortfolioItem> {
    const updated = await this.db.portfolioItems.update(id, dto as Partial<PortfolioItem>);
    if (!updated) throw new NotFoundException('Portfolio item not found');
    await this.activity.record({
      principal,
      action: 'portfolio_item_update',
      targetTable: 'portfolio_items',
      targetId: id,
      details: { title: updated.title, is_published: updated.is_published },
    });
    return updated;
  }

  async removePortfolioItem(principal: AuthPrincipal, id: string) {
    const existing = await this.db.portfolioItems.findById(id);
    if (!existing) throw new NotFoundException('Portfolio item not found');
    await this.db.portfolioItems.delete(id);
    await this.activity.record({
      principal,
      action: 'portfolio_item_delete',
      targetTable: 'portfolio_items',
      targetId: id,
      details: { title: existing.title },
    });
    return { id, deleted: true as const };
  }

  /* ---- Contact submissions ---- */

  async allSubmissions(): Promise<ContactSubmission[]> {
    const rows = await this.db.contactSubmissions.findAll();
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  /**
   * Public lead capture from the marketing site's contact form.
   *
   * Deliberately sends no notification — real email/SMS delivery is out of
   * scope this phase. The lead simply appears in the admin Content Manager
   * inbox with status New.
   */
  async createSubmission(dto: CreateSubmissionDto): Promise<ContactSubmission> {
    return this.db.contactSubmissions.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone ?? null,
      service_interest: dto.service_interest ?? null,
      message: dto.message.trim(),
      status: 'New',
      kind: 'contact',
      details: null,
      created_at: new Date().toISOString(),
    });
  }

  async updateSubmission(
    principal: AuthPrincipal,
    id: string,
    dto: UpdateSubmissionDto,
  ): Promise<ContactSubmission> {
    const existing = await this.db.contactSubmissions.findById(id);
    if (!existing) throw new NotFoundException('Enquiry not found');

    const updated = await this.db.contactSubmissions.update(id, { status: dto.status });
    if (!updated) throw new NotFoundException('Enquiry not found');

    await this.activity.record({
      principal,
      action: 'contact_submission_status_change',
      targetTable: 'contact_submissions',
      targetId: id,
      details: { from: existing.status, to: dto.status, name: existing.name },
    });
    return updated;
  }
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/** Public content for apps/web. No auth — these are marketing pages. */
@Controller('content')
export class PublicContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('services')
  services() {
    return this.content.services();
  }

  @Public()
  @Get('portfolio')
  portfolio(@Query('category') category?: string) {
    return this.content.publishedPortfolio(category);
  }

  @Public()
  @Get('testimonials')
  testimonials() {
    return this.content.publishedTestimonials();
  }
}

@Controller('testimonials')
@Roles('Admin', 'Designer', 'Installer')
export class TestimonialsController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list() {
    return this.content.allTestimonials();
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateTestimonialDto) {
    return this.content.createTestimonial(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.content.updateTestimonial(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.content.removeTestimonial(principal, id);
  }
}

@Controller('portfolio-items')
@Roles('Admin', 'Designer', 'Installer')
export class PortfolioItemsController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list() {
    return this.content.allPortfolioItems();
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreatePortfolioItemDto) {
    return this.content.createPortfolioItem(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioItemDto,
  ) {
    return this.content.updatePortfolioItem(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.content.removePortfolioItem(principal, id);
  }
}

@Controller('contact-submissions')
export class ContactSubmissionsController {
  constructor(private readonly content: ContentService) {}

  /** Public: the marketing site's contact form posts here. */
  @Public()
  @Post()
  create(@Body() dto: CreateSubmissionDto) {
    return this.content.createSubmission(dto);
  }

  @Get()
  @Roles('Admin', 'Designer', 'Installer')
  list() {
    return this.content.allSubmissions();
  }

  @Put(':id')
  @Roles('Admin', 'Designer')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.content.updateSubmission(principal, id, dto);
  }
}

@Module({
  controllers: [
    PublicContentController,
    TestimonialsController,
    PortfolioItemsController,
    ContactSubmissionsController,
  ],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
