import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SourceManifest {
  file: string;
  source_repo: string;
  source_path: string;
  commit_hash: string;
  retrieved_via: string;
  license: string;
}

const REPOS = [
  {
    name: 'python-rsa',
    url: 'https://github.com/sybrenstuvel/python-rsa',
    license: 'Apache-2.0',
    files: [
      {
        type: 'vulnerable',
        destName: 'external_vuln_001.py',
        srcPath: 'rsa/key.py'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_002.py',
        srcPath: 'rsa/pkcs1.py'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_011.py',
        srcPath: 'rsa/util.py'
      },
      {
        type: 'clean',
        destName: 'external_clean_002.py',
        srcPath: 'rsa/asn1.py'
      }
    ]
  },
  {
    name: 'pycryptodome',
    url: 'https://github.com/Legrandin/pycryptodome',
    license: 'BSD-2-Clause',
    files: [
      {
        type: 'vulnerable',
        destName: 'external_vuln_003.py',
        srcPath: 'lib/Crypto/PublicKey/RSA.py'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_004.py',
        srcPath: 'lib/Crypto/Signature/pkcs1_15.py'
      },
      {
        type: 'clean',
        destName: 'external_clean_003.py',
        srcPath: 'lib/Crypto/Util/Padding.py'
      },
      {
        type: 'clean',
        destName: 'external_clean_004.py',
        srcPath: 'lib/Crypto/Util/py3compat.py'
      }
    ]
  },
  {
    name: 'java-jwt',
    url: 'https://github.com/auth0/java-jwt',
    license: 'MIT',
    files: [
      {
        type: 'vulnerable',
        destName: 'external_vuln_005.java',
        srcPath: 'lib/src/main/java/com/auth0/jwt/algorithms/CryptoHelper.java'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_006.java',
        srcPath: 'lib/src/main/java/com/auth0/jwt/algorithms/RSAAlgorithm.java'
      },
      {
        type: 'clean',
        destName: 'external_clean_005.java',
        srcPath: 'lib/src/main/java/com/auth0/jwt/impl/BasicHeader.java'
      },
      {
        type: 'clean',
        destName: 'external_clean_006.java',
        srcPath: 'lib/src/main/java/com/auth0/jwt/impl/ClaimsHolder.java'
      }
    ]
  },
  {
    name: 'libssh2',
    url: 'https://github.com/libssh2/libssh2',
    license: 'BSD-3-Clause',
    files: [
      {
        type: 'vulnerable',
        destName: 'external_vuln_007.cpp',
        srcPath: 'src/openssl.c'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_008.cpp',
        srcPath: 'src/kex.c'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_009.cpp',
        srcPath: 'src/agent.c'
      },
      {
        type: 'vulnerable',
        destName: 'external_vuln_010.cpp',
        srcPath: 'src/openssl.h'
      },
      {
        type: 'clean',
        destName: 'external_clean_007.cpp',
        srcPath: 'src/sftp.c'
      },
      {
        type: 'clean',
        destName: 'external_clean_008.cpp',
        srcPath: 'src/misc.c'
      },
      {
        type: 'clean',
        destName: 'external_clean_009.cpp',
        srcPath: 'src/channel.c'
      },
      {
        type: 'clean',
        destName: 'external_clean_010.cpp',
        srcPath: 'src/comp.c'
      }
    ]
  }
];

async function main() {
  const targetDir = path.join(process.cwd(), 'test-data-external');
  const vulnerableDir = path.join(targetDir, 'vulnerable');
  const cleanDir = path.join(targetDir, 'clean');
  const tempClonesDir = path.join(process.cwd(), 'scratch', 'temp_clones');

  console.log('Cleaning up existing test-data-external contents...');
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(vulnerableDir, { recursive: true });
  fs.mkdirSync(cleanDir, { recursive: true });

  if (fs.existsSync(tempClonesDir)) {
    fs.rmSync(tempClonesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempClonesDir, { recursive: true });

  const vulnerableManifests: SourceManifest[] = [];
  const cleanManifests: SourceManifest[] = [];

  for (const repo of REPOS) {
    const clonePath = path.join(tempClonesDir, repo.name);
    console.log(`\n--------------------------------------------------`);
    console.log(`Cloning Repository: ${repo.url} ...`);
    execSync(`git clone --depth 1 ${repo.url} "${clonePath}"`, { stdio: 'inherit' });

    const commitHash = execSync(`git rev-parse HEAD`, { cwd: clonePath }).toString().trim();
    console.log(`Repository Commit SHA: ${commitHash}`);

    for (const file of repo.files) {
      const srcFilePath = path.join(clonePath, file.srcPath);
      const destDir = file.type === 'vulnerable' ? vulnerableDir : cleanDir;
      const destFilePath = path.join(destDir, file.destName);

      if (!fs.existsSync(srcFilePath)) {
        console.warn(`Warning: Source file not found in clone: ${file.srcPath}`);
        continue;
      }

      // Copy exact contents
      fs.copyFileSync(srcFilePath, destFilePath);
      console.log(`Copied ${file.srcPath} -> test-data-external/${file.type}/${file.destName}`);

      // Verification log: print first 5 lines of code
      const fileLines = fs.readFileSync(destFilePath, 'utf8').split(/\r?\n/).slice(0, 5);
      console.log(`Verification (First 5 lines of ${file.destName}):`);
      fileLines.forEach((line, idx) => console.log(`  ${idx + 1}: ${line}`));

      const manifest: SourceManifest = {
        file: file.destName,
        source_repo: repo.url,
        source_path: file.srcPath,
        commit_hash: commitHash,
        retrieved_via: 'git clone',
        license: repo.license
      };

      if (file.type === 'vulnerable') {
        vulnerableManifests.push(manifest);
      } else {
        cleanManifests.push(manifest);
      }
    }
  }

  // Write manifests
  fs.writeFileSync(path.join(vulnerableDir, 'sources.json'), JSON.stringify(vulnerableManifests, null, 2));
  fs.writeFileSync(path.join(cleanDir, 'sources.json'), JSON.stringify(cleanManifests, null, 2));
  console.log(`\nWritten vulnerable/sources.json and clean/sources.json`);

  // Cleanup temp clones
  console.log(`Cleaning up temporary clone repositories...`);
  try {
    fs.rmSync(tempClonesDir, { recursive: true, force: true });
  } catch (e) {
    console.log('Temporary directory cleanup skipped or locked (Windows lock). Cleanup will be handled by the OS.');
  }
  console.log(`Fetch process complete!`);
}

main().catch(err => {
  console.error('Fatal fetch script error:', err);
  process.exit(1);
});
