import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MeasurementUnit,
  StorageLocation,
} from '../../../../generated/prisma/client.js';
import { Type } from 'class-transformer';

export class UpdateItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 3,
  })
  @Min(0.001)
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsEnum(MeasurementUnit)
  unit?: MeasurementUnit;

  @IsOptional()
  @IsEnum(StorageLocation)
  storageLocation?: StorageLocation;

  @IsOptional()
  @IsDateString()
  manufacturedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
