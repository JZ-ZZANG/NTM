import sharp from 'sharp';
import zlib from 'zlib';

export class NaimetaService {
  /**
   * 이미지의 알파 채널 LSB에서 Stealth 메타데이터를 추출합니다.
   * @param imagePath 이미지 파일 경로
   */
  static async extractStealthMetadata(imagePath: string): Promise<any> {
    try {
      // 0. 표준 PNG 메타데이터(Text Chunks)를 먼저 확인
      const image = sharp(imagePath);
      const { text } = await image.metadata();

      if (text) {
        // NovelAI는 주로 'Description'이나 'Comment', 'Software' 키를 사용함
        const rawJson = text.Description || text.Comment || text.comment;
        if (rawJson) {
          try {
            const metadata = JSON.parse(rawJson);
            // 추출된 데이터가 찾는 구조인지 확인
            if (metadata.prompt || metadata.v4_prompt || metadata.Comment) {
              return this.postProcessMetadata(metadata);
            }
          } catch (e) {
            // JSON 파싱 실패 시 Stealth 방식 시도로 넘어감
          }
        }
      }

      // 1. 이미지 로드 및 Raw RGBA 버퍼 추출
      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { width, height, channels } = info;
      if (channels !== 4) throw new Error('No alpha channel found');

      // 2. 알파 채널 LSB 데이터 추출 (Python의 byteize 로직 구현)
      // Python의 alpha.T.reshape((-1,)) 로직에 따라 Column-major 순서로 읽어야 함
      const lsbBuffer = this.extractLSBBits(data, width, height);
      
      const reader = new LSBReader(lsbBuffer);

      // 3. 매직 넘버 확인 ("stealth_pngcomp")
      const magic = "stealth_pngcomp";
      const readMagic = reader.getNextBytes(magic.length).toString('utf-8');
      
      if (magic !== readMagic) {
        throw new Error('Invalid magic number: Not a stealth-encoded image');
      }

      // 4. 데이터 길이 읽기 (32-bit Big Endian, bit 단위이므로 8로 나눔)
      const readLenBits = reader.read32BitInteger();
      if (readLenBits === null) throw new Error('Failed to read metadata length');
      const dataLen = Math.floor(readLenBits / 8);

      // 5. Gzip 압축 데이터 추출 및 해제
      const compressedData = reader.getNextBytes(dataLen);
      const decompressed = zlib.gunzipSync(compressedData);
      
      // 6. JSON 파싱
      const jsonString = decompressed.toString('utf-8');
      const metadata = JSON.parse(jsonString);

      return this.postProcessMetadata(metadata);
    } catch (error) {
      console.error('[NaimetaService] Extraction failed:', error);
      throw error;
    }
  }

  /**
   * 추출된 메타데이터의 후처리 (내포된 JSON 파싱 등)
   */
  private static postProcessMetadata(metadata: any): any {
    if (metadata.Comment && typeof metadata.Comment === 'string') {
      try {
        metadata.Comment = JSON.parse(metadata.Comment);
      } catch {
        // 일반 문자열인 경우 유지
      }
    }
    return metadata;
  }

  /**
   * 이미지 버퍼에서 LSB 비트들을 모아 바이트 버퍼로 변환 (Column-major)
   */
  private static extractLSBBits(rawBuffer: Buffer, width: number, height: number): Buffer {
    const totalPixels = width * height;
    const byteCount = Math.floor(totalPixels / 8);
    const result = Buffer.alloc(byteCount);

    let currentByte = 0;
    let bitCount = 0;
    let resultIdx = 0;

    // Python의 alpha.T (Transpose) 대응을 위해 x축부터 순회 (Column-major)
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (resultIdx >= byteCount) break;

        const pixelIdx = (y * width + x) * 4;
        const alphaValue = rawBuffer[pixelIdx + 3]; // RGBA 중 A
        const lsb = alphaValue & 1;

        currentByte = (currentByte << 1) | lsb;
        bitCount++;

        if (bitCount === 8) {
          result[resultIdx++] = currentByte;
          currentByte = 0;
          bitCount = 0;
        }
      }
    }
    return result;
  }
}

/**
 * LSB 추출 데이터 스트림을 읽기 위한 헬퍼 클래스
 */
class LSBReader {
  private pos: number = 0;
  constructor(private data: Buffer) {}

  getNextBytes(n: number): Buffer {
    const slice = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  read32BitInteger(): number | null {
    if (this.pos + 4 > this.data.length) return null;
    const value = this.data.readUInt32BE(this.pos);
    this.pos += 4;
    return value;
  }
}