import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Length(2, 2)
  code: string;
}
